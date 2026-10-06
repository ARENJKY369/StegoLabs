"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, ChevronDown, Download, HelpCircle, Wand2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import DropZone from "@/components/ui/DropZone";
import PasswordField from "@/components/ui/PasswordField";
import Tooltip from "@/components/ui/Tooltip";
import { ApiError, postFormForFile } from "@/lib/api";
import { formatBytes, utf8Length } from "@/lib/format";
import {
  audioCapacity,
  formatDb,
  formatDuration,
  parseWav,
  waveformBuckets,
  type HideAudioMeta,
  type WavInfo,
} from "@/lib/audio";

interface Carrier {
  file: File;
  url: string;
  info: WavInfo;
  buffer: ArrayBuffer;
}

export default function HideAudio({ onSwitchToExtract }: { onSwitchToExtract: () => void }) {
  const [carrier, setCarrier] = useState<Carrier | null>(null);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [bitDepth, setBitDepth] = useState<1 | 2>(1);
  const [channelSel, setChannelSel] = useState<"LR" | "L" | "R">("LR");
  const [mode, setMode] = useState<"sequential" | "scattered">("scattered");
  const [decoyOn, setDecoyOn] = useState(false);
  const [decoyMessage, setDecoyMessage] = useState("");
  const [decoyPassword, setDecoyPassword] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; meta: HideAudioMeta; name: string } | null>(null);

  const waveRef = useRef<HTMLCanvasElement>(null);
  const waveStegoRef = useRef<HTMLCanvasElement>(null);

  // ---- file intake ----
  const acceptFile = async (file: File) => {
    setError(null);
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const info = parseWav(buffer);
      if (info.durationSeconds < 0.5) {
        setError("This recording is under half a second — too short to hide anything safely.");
        return;
      }
      setCarrier((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { file, url: URL.createObjectURL(file), info, buffer };
      });
      if (info.channels === 1) setChannelSel("L");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this WAV file.");
    }
  };

  // ---- waveforms ----
  useEffect(() => {
    if (!carrier || !waveRef.current) return;
    drawWave(waveRef.current, carrier.buffer, carrier.info, "#a78bfa");
  }, [carrier]);

  useEffect(() => {
    if (!result || !waveStegoRef.current) return;
    void (async () => {
      const buf = await (await fetch(result.url)).arrayBuffer();
      try {
        drawWave(waveStegoRef.current!, buf, parseWav(buf), "#23d18b");
      } catch {
        /* stego wave stays hidden on parse failure */
      }
    })();
  }, [result]);

  const capacity = useMemo(() => {
    if (!carrier) return 0;
    const sel = channelSel === "LR" ? (carrier.info.channels as 1 | 2) : 1;
    return audioCapacity(carrier.info, bitDepth, sel, decoyOn);
  }, [carrier, bitDepth, channelSel, decoyOn]);

  const messageBytes = utf8Length(message);
  const capacityFraction = capacity > 0 ? Math.min(1, messageBytes / capacity) : 0;
  const overCapacity = messageBytes > capacity && capacity > 0;

  // ---- submit ----
  const submit = async () => {
    if (!carrier || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { blob, meta, filename } = await postFormForFile<HideAudioMeta>("/api/hide/audio", {
        file: carrier.file,
        message,
        password,
        bitDepth: String(bitDepth),
        channels: channelSel,
        mode,
        decoyMessage: decoyOn ? decoyMessage : undefined,
        decoyPassword: decoyOn ? decoyPassword : undefined,
      });
      setResult({ url: URL.createObjectURL(blob), meta, name: filename ?? "stego.wav" });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong while hiding.");
    } finally {
      setBusy(false);
    }
  };

  const canRun =
    carrier !== null &&
    message.trim().length > 0 &&
    password.length > 0 &&
    !overCapacity &&
    (!decoyOn || (decoyMessage.trim().length > 0 && decoyPassword.length > 0 && decoyPassword !== password));

  const inputCls =
    "w-full rounded-md border border-line bg-ground px-3 py-2 text-body text-ink placeholder:text-ink-faint focus:border-line-bright focus:outline-none";

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* ================= left: controls ================= */}
      <section className="space-y-4">
        <DropZone
          onFile={(f) => void acceptFile(f)}
          accept=".wav,audio/wav,audio/x-wav"
          accent="grape"
          headline="Drop a WAV recording"
          note="Uncompressed PCM, mono or stereo, 8 or 16 bit"
          icon={<AudioLines size={16} strokeWidth={1.8} />}
          compact={carrier !== null}
        />

        {carrier && (
          <div className="rounded-card border border-line bg-card p-3.5">
            <p className="truncate text-body font-medium text-ink">{carrier.file.name}</p>
            <p className="mt-1 font-mono text-[11px] text-ink-faint">
              {formatBytes(carrier.file.size)} · {carrier.info.channels === 1 ? "mono" : "stereo"} ·{" "}
              {carrier.info.bitsPerSample}-bit · {(carrier.info.sampleRate / 1000).toFixed(1)} kHz ·{" "}
              {formatDuration(carrier.info.durationSeconds)}
            </p>
            <canvas ref={waveRef} className="mt-2.5 h-16 w-full rounded bg-ground" />
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
              Secret message
            </label>
            <span className={`font-mono text-[11px] tabular ${overCapacity ? "text-danger" : "text-ink-faint"}`}>
              {formatBytes(messageBytes)} / {carrier ? formatBytes(capacity) : "—"}
            </span>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Type the message to hide inside the audio…"
            className={`${inputCls} resize-none`}
          />
          {carrier && (
            <div className="mt-1.5 h-1 rounded-full bg-line">
              <div
                className={`h-full rounded-full transition-all duration-200 ${overCapacity ? "bg-danger" : "bg-grape"}`}
                style={{ width: `${Math.max(2, capacityFraction * 100)}%` }}
              />
            </div>
          )}
          {overCapacity && (
            <p className="mt-1 text-cap text-danger">
              The message no longer fits — shorten it or raise the bit depth.
            </p>
          )}
        </div>

        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          showMeter
          placeholder="Encryption password (always on)"
        />
        <p className="-mt-2 text-[11px] leading-4 text-ink-faint">
          The message is AES-256 encrypted first — the audio only ever carries
          its ciphertext.
        </p>

        {/* advanced */}
        <div className="rounded-card border border-line bg-card">
          <button
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3.5 py-2.5 text-cap font-semibold uppercase tracking-wide text-ink-faint transition-colors duration-150 hover:text-ink"
          >
            Embedding settings
            <ChevronDown size={14} className={`transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence initial={false}>
            {advancedOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 px-3.5 pb-3.5">
                  <div>
                    <div className="mb-1.5 flex items-center gap-1 text-cap text-ink-faint">
                      Bits per sample
                      <Tooltip
                        what="How many of each sample's lowest bits carry data."
                        when="1 bit is inaudible in practice; 2 bits doubles capacity and stays below the noise floor of typical recordings."
                        tip="Audio never needs 4 bits — that much change becomes audible hiss on quiet passages."
                        accent="grape"
                      >
                        <HelpCircle size={11} />
                      </Tooltip>
                    </div>
                    <div className="flex rounded-md border border-line p-0.5">
                      {([1, 2] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setBitDepth(d)}
                          className={`h-7 flex-1 rounded text-cap font-medium transition-colors duration-150 ${
                            bitDepth === d ? "bg-raise text-ink" : "text-ink-faint hover:text-ink-dim"
                          }`}
                        >
                          {d} bit{d > 1 ? "s" : ""}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center gap-1 text-cap text-ink-faint">
                      Channels
                      <Tooltip
                        what="Which audio channels carry data."
                        when="Both channels doubles capacity on stereo files."
                        tip="Hiding in only the left channel leaves the right one untouched — handy when a peek at waveforms should look identical."
                        accent="grape"
                      >
                        <HelpCircle size={11} />
                      </Tooltip>
                    </div>
                    <div className="flex rounded-md border border-line p-0.5">
                      {(["LR", "L", "R"] as const).map((c) => (
                        <button
                          key={c}
                          onClick={() => setChannelSel(c)}
                          disabled={carrier?.info.channels === 1 && c !== "L"}
                          className={`h-7 flex-1 rounded text-cap font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30 ${
                            channelSel === c ? "bg-raise text-ink" : "text-ink-faint hover:text-ink-dim"
                          }`}
                        >
                          {c === "LR" ? "Both" : c === "L" ? "Left" : "Right"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center gap-1 text-cap text-ink-faint">
                      Sample order
                      <Tooltip
                        what="Sequential fills samples in order; scattered jumps around pseudorandomly under your password."
                        when="Scattered is the default — a sequential fill concentrates all changes at the start of the recording."
                        tip="Scattered also makes forensic bit-timing analysis much harder."
                        accent="grape"
                      >
                        <HelpCircle size={11} />
                      </Tooltip>
                    </div>
                    <div className="flex rounded-md border border-line p-0.5">
                      {(["scattered", "sequential"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setMode(m)}
                          className={`h-7 flex-1 rounded text-cap font-medium capitalize transition-colors duration-150 ${
                            mode === m ? "bg-raise text-ink" : "text-ink-faint hover:text-ink-dim"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center justify-between text-cap text-ink-dim">
                    <span className="flex items-center gap-1">
                      Decoy message
                      <Tooltip
                        what="Hides a second, harmless message under its own password."
                        when="If you're ever compelled to reveal a password, hand over the decoy one — it opens a plausible innocent text while the real one stays sealed."
                        tip="The two passwords must be different. There is no visible trace that a second message exists."
                        accent="grape"
                      >
                        <HelpCircle size={11} />
                      </Tooltip>
                    </span>
                    <button
                      onClick={() => setDecoyOn((v) => !v)}
                      className={`relative h-5 w-9 rounded-full transition-colors duration-150 ${decoyOn ? "bg-grape" : "bg-line"}`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-transform duration-150 ${decoyOn ? "translate-x-4" : "translate-x-0.5"}`}
                      />
                    </button>
                  </label>
                  {decoyOn && (
                    <div className="space-y-2">
                      <textarea
                        value={decoyMessage}
                        onChange={(e) => setDecoyMessage(e.target.value)}
                        rows={2}
                        placeholder="The innocent cover story…"
                        className={`${inputCls} resize-none`}
                      />
                      <PasswordField
                        label="Decoy password"
                        value={decoyPassword}
                        onChange={setDecoyPassword}
                        placeholder="Different from the real one"
                      />
                      {decoyPassword && decoyPassword === password && (
                        <p className="text-cap text-danger">
                          The decoy password must differ from the real one.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <div className="rounded-card border border-danger-edge bg-danger-dim px-4 py-3 text-body text-ink">
            {error}
          </div>
        )}

        <button
          onClick={() => void submit()}
          disabled={!canRun || busy}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-b from-grape to-[#7c5ce0] px-4 text-body font-semibold text-white transition-all duration-150 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Wand2 size={15} />
          {busy ? "Embedding…" : "Hide message in audio"}
        </button>

        {result && (
          <button
            onClick={onSwitchToExtract}
            className="h-9 w-full rounded-md border border-line px-3 text-cap font-medium text-ink-dim transition-colors duration-150 hover:border-line-bright hover:text-ink"
          >
            Switch to Extract to verify →
          </button>
        )}
      </section>

      {/* ================= right: preview ================= */}
      <section>
        {!result ? (
          <div className="grid min-h-[300px] place-items-center rounded-card border border-line bg-card p-8">
            <div className="max-w-md text-center">
              <AudioLines className="mx-auto text-grape" size={28} strokeWidth={1.5} />
              <h3 className="mt-3 text-section text-ink">Your stego audio appears here</h3>
              <p className="mt-2 text-body text-ink-dim">
                Load a WAV on the left, type a message, press hide. You&apos;ll
                get the embedded recording back with its quality measurements —
                signal-to-noise ratio tells you how deep below the audible
                threshold the change sits.
              </p>
              <div className="mx-auto mt-4 max-w-sm rounded-card border border-line bg-ground p-3.5 text-left text-cap leading-5 text-ink-dim">
                <p className="font-semibold uppercase tracking-wide text-ink-faint">In practice</p>
                <p className="mt-1.5">
                  LSB audio steganography is <em>fragile</em>: any re-encoding
                  (MP3, AAC, most messengers&apos; voice messages) destroys the
                  message. Deliver the WAV file itself, uncompromised.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <HideResult
            result={result}
            carrierUrl={carrier!.url}
            waveRef={waveStegoRef}
            onDiscard={() => setResult(null)}
          />
        )}
      </section>
    </div>
  );
}

function drawWave(canvas: HTMLCanvasElement, buffer: ArrayBuffer, info: WavInfo, color: string) {
  const W = 640;
  const H = 128;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  const { min, max } = waveformBuckets(buffer, info, W);
  const mid = H / 2;
  const half = H / 2 - 2;
  ctx.fillStyle = color;
  for (let x = 0; x < W; x++) {
    const y1 = mid - max[x] * half;
    const y2 = mid - min[x] * half;
    ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
  }
}

function HideResult({
  result,
  carrierUrl,
  waveRef,
  onDiscard,
}: {
  result: { url: string; meta: HideAudioMeta; name: string };
  carrierUrl: string;
  waveRef: React.RefObject<HTMLCanvasElement>;
  onDiscard: () => void;
}) {
  const m = result.meta;
  const quality =
    !isFinite(m.snr) || m.snr >= 60 ? { label: "Inaudible", cls: "text-mint border-mint-edge bg-mint-dim" } :
    m.snr >= 40 ? { label: "Likely masked", cls: "text-amber border-amber-edge bg-amber-dim" } :
    { label: "Possibly audible", cls: "text-danger border-danger-edge bg-danger-dim" };
  return (
    <div className="space-y-4">
      <div className="rounded-card border border-mint-edge bg-mint-dim px-4 py-3">
        <p className="text-body font-medium text-mint">Message hidden — {result.name}</p>
        <p className="mt-0.5 text-cap text-ink-dim">
          {formatBytes(m.bytesEmbedded)} embedded · {(m.capacityUsed * 100).toFixed(2)}% of capacity ·{" "}
          {m.changedSamples.toLocaleString()} samples modified
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-card border border-line bg-card p-3.5">
          <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">Original</p>
          <audio controls src={carrierUrl} className="mt-2 w-full" />
        </div>
        <div className="rounded-card border border-line bg-card p-3.5">
          <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">Stego copy</p>
          <audio controls src={result.url} className="mt-2 w-full" />
        </div>
      </div>

      <div className="rounded-card border border-line bg-card p-3.5">
        <div className="flex items-center justify-between">
          <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
            Stego waveform · {m.channels} · {m.bitDepth} bit{m.bitDepth > 1 ? "s" : ""} · {m.placementMode}
          </p>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${quality.cls}`}>
            {quality.label}
          </span>
        </div>
        <canvas ref={waveRef} className="mt-2.5 h-16 w-full rounded bg-ground" />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Metric label="Signal-to-noise" value={formatDb(m.snr)} hint="higher is better" />
          <Metric label="PSNR" value={formatDb(m.psnr)} hint="vs full scale" />
          <Metric
            label="Duration"
            value={formatDuration(m.durationSeconds)}
            hint={`${m.bitsPerSample}-bit ${m.channelCount === 1 ? "mono" : "stereo"}`}
          />
        </div>
        <p className="mt-3 text-[11px] leading-4 text-ink-faint">
          Above ~60 dB SNR the modification sits below normal hearing
          thresholds. Both recordings sound identical because, physically, they
          nearly are.
        </p>
      </div>

      <div className="flex gap-2">
        <a
          href={result.url}
          download={result.name}
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-gradient-to-b from-grape to-[#7c5ce0] px-4 text-body font-semibold text-white transition-all duration-150 hover:brightness-110"
        >
          <Download size={15} /> Download stego WAV
        </a>
        <button
          onClick={onDiscard}
          className="h-10 rounded-md border border-line px-4 text-cap font-medium text-ink-dim transition-colors duration-150 hover:border-line-bright hover:text-ink"
        >
          Discard & tweak
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-line bg-ground px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 font-mono text-body font-semibold text-ink tabular">{value}</p>
      <p className="text-[10px] text-ink-faint">{hint}</p>
    </div>
  );
}
