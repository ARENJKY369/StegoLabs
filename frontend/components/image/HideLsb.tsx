"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Download,
  ImageIcon,
  Layers,
  Wand2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import DropZone from "@/components/ui/DropZone";
import PasswordField from "@/components/ui/PasswordField";
import Tooltip from "@/components/ui/Tooltip";
import { ApiError, postFormForFile } from "@/lib/api";
import { formatBytes, timestamp, utf8Length } from "@/lib/format";
import { drawAmplifiedDiff, drawLsbPlane, loadImageData } from "@/lib/canvas";

interface HideMeta {
  psnr: number;
  ssim: number;
  mse: number;
  capacityUsed: number;
  bytesEmbedded: number;
  capacityBytes: number;
  placementMode: string;
}

interface LogLine {
  time: string;
  tag: "ok" | "info" | "err";
  text: string;
}

interface CarrierInfo {
  file: File;
  url: string;
  width: number;
  height: number;
  format: string;
}

const ENVELOPE_OVERHEAD = 54; // magic+version+flags+salt+iv+len+tag

export default function HideLsb({
  onSwitchToExtract,
}: {
  onSwitchToExtract: () => void;
}) {
  const [carrier, setCarrier] = useState<CarrierInfo | null>(null);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [bitDepth, setBitDepth] = useState<1 | 2 | 4>(1);
  const [channels, setChannels] = useState<Set<string>>(new Set(["R", "G", "B"]));
  const [mode, setMode] = useState<"scattered" | "sequential">("scattered");
  const [decoyOn, setDecoyOn] = useState(false);
  const [decoyMessage, setDecoyMessage] = useState("");
  const [decoyPassword, setDecoyPassword] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [result, setResult] = useState<{ url: string; meta: HideMeta; name: string } | null>(null);
  const [diffChanged, setDiffChanged] = useState<number | null>(null);

  const diffRef = useRef<HTMLCanvasElement>(null);
  const planeR = useRef<HTMLCanvasElement>(null);
  const planeG = useRef<HTMLCanvasElement>(null);
  const planeB = useRef<HTMLCanvasElement>(null);

  const pushLog = (tag: LogLine["tag"], text: string) =>
    setLog((l) => [...l, { time: timestamp(), tag, text }]);

  // ---- derived numbers ----
  const messageBytes = utf8Length(message);
  const capacity = useMemo(() => {
    if (!carrier) return 0;
    const usablePixels = carrier.width * carrier.height - 40; // header reserve
    const raw = Math.floor((usablePixels * channels.size * bitDepth) / 8);
    const region = decoyOn ? Math.floor(raw / 2) : raw;
    return Math.max(0, region - ENVELOPE_OVERHEAD);
  }, [carrier, channels, bitDepth, decoyOn]);

  const capacityFraction = capacity > 0 ? Math.min(1, messageBytes / capacity) : 0;

  const estimatedPsnr = useMemo(() => {
    if (!carrier || messageBytes === 0) return null;
    const totalSamples = carrier.width * carrier.height * 3;
    const slotsUsed = ((messageBytes + ENVELOPE_OVERHEAD) * 8) / bitDepth;
    const errPerSample = (Math.pow(2, 2 * bitDepth) - 1) / 6;
    const mse = (slotsUsed / totalSamples) * errPerSample;
    if (mse <= 0) return null;
    return (10 * Math.log10((255 * 255) / mse)).toFixed(1);
  }, [carrier, messageBytes, bitDepth]);

  // ---- file intake ----
  const acceptFile = async (file: File) => {
    setError(null);
    setResult(null);
    setDiffChanged(null);
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
      setError(
        "JPEG uses lossy compression which destroys hidden data. Please convert to PNG first — Utilities → PNG converter can help.",
      );
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await loadDimensions(url);
      setCarrier({
        file,
        url,
        width: img.width,
        height: img.height,
        format: lower.endsWith(".bmp") ? "BMP" : "PNG",
      });
      setLog([]);
      pushLog("ok", `loaded ${file.name} (${img.width}×${img.height})`);
    } catch {
      setError("We could not read this file. It may be corrupted.");
    }
  };

  // ---- embed ----
  const embed = async () => {
    if (!carrier || busy) return;
    setError(null);
    setResult(null);
    setBusy(true);
    const started = performance.now();
    try {
      setStage("Deriving encryption key…");
      pushLog("info", "sealing message with AES-256-GCM (PBKDF2, 210k rounds)");
      setTimeout(() => setStage((s) => (s ? "Embedding data…" : s)), 600);

      const { blob, meta, filename } = await postFormForFile<HideMeta>(
        "/api/hide/image",
        {
          file: carrier.file,
          message,
          password,
          bitDepth: String(bitDepth),
          channels: ["R", "G", "B"].filter((c) => channels.has(c)).join(""),
          mode,
          decoyMessage: decoyOn ? decoyMessage : undefined,
          decoyPassword: decoyOn ? decoyPassword : undefined,
        },
      );

      setStage("Saving PNG…");
      const url = URL.createObjectURL(blob);
      const elapsed = Math.round(performance.now() - started);
      pushLog("ok", `embedded ${meta.bytesEmbedded} bytes (${meta.placementMode}) in ${elapsed} ms`);
      pushLog("ok", `psnr ${meta.psnr} dB · ssim ${meta.ssim} · mse ${meta.mse}`);
      pushLog("info", `capacity used ${(meta.capacityUsed * 100).toFixed(2)}%`);
      setResult({ url, meta, name: filename ?? "stego.png" });

      // draw diff + LSB planes
      const [orig, stego] = await Promise.all([
        loadImageData(carrier.url),
        loadImageData(url),
      ]);
      if (diffRef.current) {
        const changed = drawAmplifiedDiff(diffRef.current, orig, stego, 20);
        setDiffChanged(changed);
        pushLog("info", `${changed.toLocaleString()} pixels carry at least one flipped bit`);
      }
      if (planeR.current) drawLsbPlane(planeR.current, stego, 0);
      if (planeG.current) drawLsbPlane(planeG.current, stego, 1);
      if (planeB.current) drawLsbPlane(planeB.current, stego, 2);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong on our side. Please try again.";
      setError(msg);
      pushLog("err", msg);
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const canEmbed =
    !!carrier &&
    message.length > 0 &&
    password.length > 0 &&
    channels.size > 0 &&
    capacityFraction < 1 &&
    (!decoyOn || (decoyMessage.length > 0 && decoyPassword.length > 0));

  return (
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)_300px]">
      {/* ------------------------------------------------ left: config */}
      <section className="space-y-4">
        <DropZone
          onFile={acceptFile}
          accept=".png,.bmp,image/png,image/bmp"
          accent="teal"
          headline="Drop PNG or BMP here"
          note="Lossless formats only — JPEG would crush the hidden bits"
          icon={<ImageIcon size={16} strokeWidth={1.8} />}
        />

        {carrier && (
          <div className="rounded-card border border-line bg-card px-4 py-3">
            <p className="truncate text-body font-medium text-ink">{carrier.file.name}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-cap text-ink-faint">
              <span>{carrier.width}×{carrier.height}px</span>
              <span>{formatBytes(carrier.file.size)}</span>
              <span>{carrier.format}</span>
            </div>
          </div>
        )}

        {/* message */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="secret-message" className="text-cap font-medium text-ink-dim">
              Secret message
            </label>
            <span className="font-mono text-cap text-ink-faint tabular">
              {messageBytes} B{capacity > 0 ? ` / ${formatBytes(capacity)}` : ""}
            </span>
          </div>
          <textarea
            id="secret-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            spellCheck={false}
            placeholder={
              carrier
                ? "Meet me at the north entrance at 7 — bring the blue folder."
                : "Load an image first, then write your message here."
            }
            className="w-full resize-y rounded-md border border-line bg-raise px-3 py-2 font-mono text-[12px] leading-5 text-ink placeholder:text-ink-faint focus:border-line-bright"
          />
          {/* capacity bar */}
          <Tooltip
            what="How much of the image's hiding space your message occupies at the current settings."
            when="Watch it while typing — if it fills up, raise the bit depth or pick a larger image."
            tip="Staying under 10% keeps the statistical footprint small and the image hard to flag."
            accent="teal"
          >
            <div className="mt-1.5 cursor-help">
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    capacityFraction >= 1
                      ? "bg-danger"
                      : capacityFraction > 0.65
                        ? "bg-amber"
                        : "bg-teal"
                  }`}
                  style={{ width: `${Math.min(100, capacityFraction * 100)}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-cap text-ink-faint">
                <span>Capacity used</span>
                <span className="font-mono tabular">
                  {carrier ? `${(capacityFraction * 100).toFixed(1)}%` : "—"}
                </span>
              </div>
            </div>
          </Tooltip>
        </div>

        <Tooltip
          what="Encrypts your message before hiding it. Even if someone finds the hidden bits, they cannot read it without your password."
          when="Always. Encryption is mandatory in StegLab."
          tip="AES-256 is the same standard used by banks and governments. GCM mode also detects if anyone tampers with the file."
          accent="teal"
        >
          <div>
            <PasswordField label="Password" value={password} onChange={setPassword} />
          </div>
        </Tooltip>

        {/* decoy */}
        <div className="rounded-card border border-line bg-card p-3.5">
          <Tooltip
            what="Lets you hide two separate messages. One real password reveals the true message. A decoy password reveals a harmless cover message."
            when="If there is any chance someone could force you to reveal your password. Give them the decoy password."
            tip="The app gives no indication a second message exists. This is called plausible deniability."
            accent="teal"
          >
            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-body font-medium text-ink">Decoy mode</span>
              <span
                role="switch"
                aria-checked={decoyOn}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDecoyOn((v) => !v);
                  }
                }}
                onClick={() => setDecoyOn((v) => !v)}
                className={`relative h-5 w-9 rounded-full transition-colors duration-150 ${
                  decoyOn ? "bg-teal" : "bg-line"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-all duration-150 ${
                    decoyOn ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </span>
            </label>
          </Tooltip>
          <AnimatePresence initial={false}>
            {decoyOn && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-3">
                  <textarea
                    value={decoyMessage}
                    onChange={(e) => setDecoyMessage(e.target.value)}
                    rows={2}
                    spellCheck={false}
                    placeholder="Harmless cover message, e.g. a grocery list."
                    className="w-full resize-y rounded-md border border-line bg-raise px-3 py-2 font-mono text-[12px] leading-5 text-ink placeholder:text-ink-faint focus:border-line-bright"
                  />
                  <PasswordField
                    label="Decoy password"
                    value={decoyPassword}
                    onChange={setDecoyPassword}
                    placeholder="Different from your real password"
                    showMeter={false}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* advanced options */}
        <div className="rounded-card border border-line bg-card">
          <button
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3.5 py-3 text-body font-medium text-ink-dim transition-colors duration-150 hover:text-ink"
          >
            Advanced options
            <ChevronDown
              size={14}
              className={`transition-transform duration-150 ${advancedOpen ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {advancedOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 border-t border-line px-3.5 py-4">
                  {/* bit depth */}
                  <div>
                    <Tooltip
                      what="Changes only 1 bit per colour channel, the safest option."
                      when="When you want maximum invisibility with any image."
                      tip="This is the default for a reason. Only go higher if your message is too large for 1-bit mode."
                      accent="teal"
                    >
                      <p className="mb-1.5 inline-block cursor-help text-cap font-medium text-ink-dim underline decoration-dotted decoration-ink-faint underline-offset-2">
                        Bit depth
                      </p>
                    </Tooltip>
                    <div className="grid grid-cols-3 gap-1 rounded-md border border-line bg-raise p-0.5">
                      {([1, 2, 4] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setBitDepth(d)}
                          className={`rounded px-2 py-1.5 font-mono text-cap transition-colors duration-150 ${
                            bitDepth === d
                              ? "bg-teal-dim text-teal"
                              : "text-ink-faint hover:text-ink-dim"
                          }`}
                        >
                          {d}-bit
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* channels */}
                  <div>
                    <p className="mb-1.5 text-cap font-medium text-ink-dim">Channels</p>
                    <div className="flex gap-1.5">
                      {(
                        [
                          ["R", "text-danger border-danger-edge", "bg-danger-dim"],
                          ["G", "text-mint border-mint-edge", "bg-mint-dim"],
                          ["B", "text-azure border-azure-edge", "bg-azure-dim"],
                        ] as const
                      ).map(([c, colorOn, bgOn]) => {
                        const on = channels.has(c);
                        return (
                          <button
                            key={c}
                            onClick={() =>
                              setChannels((prev) => {
                                const next = new Set(prev);
                                if (on) next.delete(c);
                                else next.add(c);
                                return next.size === 0 ? prev : next;
                              })
                            }
                            className={`h-8 w-10 rounded-md border font-mono text-cap font-semibold transition-colors duration-150 ${
                              on
                                ? `${colorOn} ${bgOn}`
                                : "border-line text-ink-faint hover:text-ink-dim"
                            }`}
                          >
                            {c}
                          </button>
                        );
                      })}
                      <Tooltip
                        what="PNG alpha (transparency) is not used for hiding — fully transparent pixels get dropped by many apps, taking your bits with them."
                        accent="teal"
                      >
                        <span className="grid h-8 w-10 cursor-not-allowed place-items-center rounded-md border border-line font-mono text-cap text-ink-faint/50">
                          A
                        </span>
                      </Tooltip>
                    </div>
                  </div>

                  {/* pixel order */}
                  <div>
                    <Tooltip
                      what="Uses your password to randomly shuffle which pixels carry hidden data across the whole image."
                      when="Always — it is significantly harder to detect than sequential mode."
                      tip="Both sender and receiver must use the same password. The order cannot be reconstructed without it."
                      accent="teal"
                    >
                      <label
                        htmlFor="pixel-order"
                        className="mb-1.5 inline-block cursor-help text-cap font-medium text-ink-dim underline decoration-dotted decoration-ink-faint underline-offset-2"
                      >
                        Pixel order
                      </label>
                    </Tooltip>
                    <select
                      id="pixel-order"
                      value={mode}
                      onChange={(e) => setMode(e.target.value as typeof mode)}
                      className="h-9 w-full rounded-md border border-line bg-raise px-2.5 text-body text-ink focus:border-line-bright"
                    >
                      <option value="scattered">Password-scattered (recommended)</option>
                      <option value="sequential">Sequential (easier to detect)</option>
                    </select>
                  </div>

                  {/* encryption */}
                  <div>
                    <label htmlFor="cipher" className="mb-1.5 block text-cap font-medium text-ink-dim">
                      Encryption
                    </label>
                    <select
                      id="cipher"
                      disabled
                      className="h-9 w-full cursor-not-allowed rounded-md border border-line bg-raise px-2.5 text-body text-ink-dim"
                    >
                      <option>AES-256-GCM · PBKDF2 (always on)</option>
                    </select>
                  </div>

                  {estimatedPsnr && (
                    <p className="font-mono text-cap text-ink-faint">
                      Estimated PSNR ≈ {estimatedPsnr} dB
                    </p>
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

        <div className="flex gap-2.5">
          <button
            onClick={embed}
            disabled={!canEmbed || busy}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-gradient-to-b from-teal to-[#0bb3a2] px-4 text-body font-semibold text-ground transition-all duration-150 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Wand2 size={15} />
            {busy ? stage || "Working…" : "Embed message"}
          </button>
          <button
            onClick={onSwitchToExtract}
            className="h-10 rounded-md border border-teal-edge px-4 text-body font-medium text-teal transition-colors duration-150 hover:bg-teal-dim"
          >
            Extract
          </button>
        </div>

        {busy && (
          <div className="flex items-center gap-2.5 text-cap text-ink-dim">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-teal" />
            {stage || "Working…"}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-md border border-amber-edge bg-amber-dim px-3 py-2.5 text-cap text-ink-dim">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber" />
          Always save output as PNG — JPEG destroys hidden bits
        </div>
      </section>

      {/* ------------------------------------------------ centre: preview */}
      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <PreviewCard title="Original">
            {carrier ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={carrier.url} alt="Original carrier" className="max-h-[260px] w-full rounded object-contain" />
            ) : (
              <EmptyPreview label="No file loaded yet — drop an image to preview it" />
            )}
          </PreviewCard>
          <PreviewCard
            title="Stego output"
            action={
              result ? (
                <a
                  href={result.url}
                  download={result.name}
                  className="flex items-center gap-1.5 rounded-md border border-teal-edge px-2.5 py-1 text-cap font-medium text-teal transition-colors duration-150 hover:bg-teal-dim"
                >
                  <Download size={11} /> PNG
                </a>
              ) : null
            }
          >
            {result ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.url} alt="Stego output" className="max-h-[260px] w-full rounded object-contain" />
            ) : (
              <EmptyPreview label="Embed to see output — it will look identical to the original" />
            )}
          </PreviewCard>
        </div>

        <PreviewCard
          title="Amplified difference ×20"
          action={
            diffChanged !== null ? (
              <span className="font-mono text-cap text-ink-faint tabular">
                {diffChanged.toLocaleString()} px changed
              </span>
            ) : null
          }
        >
          <canvas
            ref={diffRef}
            className={`w-full rounded bg-black ${result ? "" : "hidden"}`}
            style={{ imageRendering: "pixelated", maxHeight: 280 }}
          />
          {!result && (
            <EmptyPreview label="After embedding, every changed pixel lights up here — amplified 20×" />
          )}
        </PreviewCard>

        {result && (
          <div className="grid grid-cols-3 gap-3">
            <Metric label="PSNR" value={`${result.meta.psnr} dB`} hint="Above 50 dB is visually identical" />
            <Metric label="SSIM" value={String(result.meta.ssim)} hint="1.0 = structurally identical" />
            <Metric label="MSE" value={String(result.meta.mse)} hint="Mean squared pixel error" />
          </div>
        )}
      </section>

      {/* ------------------------------------------------ right: log + planes */}
      <section className="space-y-4">
        <div className="rounded-card border border-line bg-card">
          <p className="border-b border-line px-3.5 py-2.5 text-cap font-semibold uppercase tracking-wide text-ink-faint">
            Embedding log
          </p>
          <div className="max-h-[220px] space-y-1 overflow-y-auto px-3.5 py-3 font-mono text-[11px] leading-[17px]">
            {log.length === 0 ? (
              <p className="text-ink-faint">Waiting for a carrier image…</p>
            ) : (
              log.map((line, i) => (
                <p key={i} className="text-ink-dim">
                  <span className="text-ink-faint">{line.time}</span>{" "}
                  <span
                    className={
                      line.tag === "ok"
                        ? "text-mint"
                        : line.tag === "err"
                          ? "text-danger"
                          : "text-azure"
                    }
                  >
                    [{line.tag}]
                  </span>{" "}
                  {line.text}
                </p>
              ))
            )}
          </div>
        </div>

        {result && (
          <div className="rounded-card border border-line bg-card p-3.5">
            <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
              Quality metrics
            </p>
            <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 text-body">
              <MetricRow k="PSNR" v={`${result.meta.psnr} dB`} />
              <MetricRow k="SSIM" v={String(result.meta.ssim)} />
              <MetricRow k="MSE" v={String(result.meta.mse)} />
              <MetricRow k="Capacity" v={`${(result.meta.capacityUsed * 100).toFixed(2)}%`} />
            </dl>
          </div>
        )}

        <div className="rounded-card border border-line bg-card p-3.5">
          <Tooltip
            what="Each panel shows only the least-significant bit of one colour channel, as pure black/white noise."
            when="After embedding, compare the planes — a natural image has organic texture, dense random noise hints at hidden data."
            tip="Scattered mode spreads changes evenly, which is exactly why it is harder to spot here."
            accent="teal"
          >
            <p className="inline-flex cursor-help items-center gap-1.5 text-cap font-semibold uppercase tracking-wide text-ink-faint">
              <Layers size={12} /> LSB channel planes
            </p>
          </Tooltip>
          {result ? (
            <div className="mt-2.5 space-y-2.5">
              {(
                [
                  ["R", planeR, "text-danger"],
                  ["G", planeG, "text-mint"],
                  ["B", planeB, "text-azure"],
                ] as const
              ).map(([label, ref, color]) => (
                <div key={label}>
                  <p className={`mb-1 font-mono text-[10px] ${color}`}>{label} plane</p>
                  <canvas
                    ref={ref}
                    className="w-full rounded bg-black"
                    style={{ imageRendering: "pixelated", maxHeight: 110 }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-cap text-ink-faint">
              Bit planes render here after embedding.
            </p>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-md border border-amber-edge bg-amber-dim px-3 py-2.5 text-cap text-ink-dim">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber" />
          Re-saving, screenshotting or compressing the stego image will corrupt the message.
        </div>
      </section>
    </div>
  );
}

// ---------- small presentational helpers ----------

function PreviewCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
        <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">{title}</p>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function EmptyPreview({ label }: { label: string }) {
  return (
    <div className="grid min-h-[140px] place-items-center rounded border border-dashed border-line px-4 text-center">
      <div>
        <ImageIcon size={18} className="mx-auto text-ink-faint" strokeWidth={1.5} />
        <p className="mt-2 max-w-[220px] text-cap text-ink-faint">{label}</p>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-card border border-line bg-card px-3.5 py-3">
      <p className="text-cap text-ink-faint">{label}</p>
      <p className="mt-0.5 font-mono text-[15px] font-semibold text-teal tabular">{value}</p>
      <p className="mt-0.5 text-[10px] leading-[14px] text-ink-faint">{hint}</p>
    </div>
  );
}

function MetricRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-cap text-ink-faint">{k}</dt>
      <dd className="font-mono text-[12px] text-ink tabular">{v}</dd>
    </div>
  );
}

function loadDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}
