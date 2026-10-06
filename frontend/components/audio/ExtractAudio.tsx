"use client";

import { useState } from "react";
import { FileAudio, KeyRound, Lock, Music, ShieldAlert, Unlock } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import DropZone from "@/components/ui/DropZone";
import PasswordField from "@/components/ui/PasswordField";
import { ApiError, postForm } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { formatDuration, parseWav, type AudioProbe, type ExtractAudioResponse } from "@/lib/audio";

interface Loaded {
  file: File;
  url: string;
  infoText: string;
}

export default function ExtractAudio() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [probe, setProbe] = useState<AudioProbe | null>(null);
  const [password, setPassword] = useState("");
  const [revealMode, setRevealMode] = useState<"real" | "decoy">("real");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractAudioResponse | null>(null);

  const acceptFile = async (file: File) => {
    setError(null);
    setErrorCode(null);
    setProbe(null);
    setResult(null);
    setPassword("");
    setRevealMode("real");
    try {
      const buf = await file.arrayBuffer();
      const info = parseWav(buf);
      setLoaded((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return {
          file,
          url: URL.createObjectURL(file),
          infoText: `${formatBytes(file.size)} · ${info.channels === 1 ? "mono" : "stereo"} · ${
            info.bitsPerSample
          }-bit · ${formatDuration(info.durationSeconds)}`,
        };
      });
      const p = await postForm<AudioProbe>("/api/extract/audio/probe", { file });
      setProbe(p);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not read this file.",
      );
    }
  };

  const submit = async () => {
    if (!loaded || busy) return;
    setBusy(true);
    setError(null);
    setErrorCode(null);
    setResult(null);
    try {
      const res = await postForm<ExtractAudioResponse>("/api/extract/audio", {
        file: loaded.file,
        password,
        revealMode,
      });
      setResult(res);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setErrorCode(e.code);
      } else {
        setError("Something went wrong while extracting.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* ================= left ================= */}
      <section className="space-y-4">
        <DropZone
          onFile={(f) => void acceptFile(f)}
          accept=".wav,audio/wav,audio/x-wav"
          accent="grape"
          headline="Drop a WAV to inspect"
          note="It is probed for a stego header without a password"
          icon={<FileAudio size={16} strokeWidth={1.8} />}
          compact={loaded !== null}
        />

        {loaded && (
          <div className="rounded-card border border-line bg-card p-3.5">
            <p className="truncate text-body font-medium text-ink">{loaded.file.name}</p>
            <p className="mt-1 font-mono text-[11px] text-ink-faint">{loaded.infoText}</p>
            <audio controls src={loaded.url} className="mt-2.5 w-full" />
          </div>
        )}

        {loaded && probe && (
          <ProbeBanner probe={probe} revealMode={revealMode} onRevealMode={setRevealMode} />
        )}

        {loaded && probe?.stegoDetected && (
          <>
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="The password used when hiding"
            />
            <button
              onClick={() => void submit()}
              disabled={password.length === 0 || busy}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-b from-grape to-[#7c5ce0] px-4 text-body font-semibold text-white transition-all duration-150 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <KeyRound size={15} />
              {busy ? "Extracting…" : "Extract message"}
            </button>
          </>
        )}

        {error && (
          <div
            className={`rounded-card border px-4 py-3 text-body ${
              errorCode === "WRONG_PASSWORD"
                ? "border-amber-edge bg-amber-dim text-ink"
                : "border-danger-edge bg-danger-dim text-ink"
            }`}
          >
            {errorCode === "WRONG_PASSWORD"
              ? "Wrong password — or the audio was modified after hiding. Both look identical by design."
              : error}
          </div>
        )}
      </section>

      {/* ================= right ================= */}
      <section>
        {!result ? (
          <div className="grid min-h-[300px] place-items-center rounded-card border border-line bg-card p-8">
            <div className="max-w-md text-center">
              <Music className="mx-auto text-grape" size={28} strokeWidth={1.5} />
              <h3 className="mt-3 text-section text-ink">The hidden message shows here</h3>
              <p className="mt-2 text-body text-ink-dim">
                Drop a WAV on the left. StegLab checks for its stego header
                first — if one is present you only need the password. If none
                is present, try the Scanner instead; it can find payloads that
                didn&apos;t come from StegLab.
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="rounded-card border border-mint-edge bg-mint-dim px-4 py-3">
                <p className="flex items-center gap-2 text-body font-medium text-mint">
                  <Unlock size={14} /> Message recovered
                </p>
                <p className="mt-0.5 text-cap text-ink-dim">
                  {result.placementMode} order · {result.bitDepth} bit{result.bitDepth > 1 ? "s" : ""} ·
                  channels {result.channels}
                  {result.revealMode === "decoy" && " · you are looking at the DECOY message"}
                </p>
              </div>

              {result.decoyPresent && result.revealMode === "real" && (
                <div className="rounded-card border border-amber-edge bg-amber-dim px-4 py-3 text-body text-ink">
                  This file also contains a decoy message. Choose &quot;Decoy&quot; on
                  the left with its own password to view it.
                </div>
              )}

              <div className="rounded-card border border-line bg-card p-4">
                <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
                  Plaintext
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-body leading-6 text-ink">
                  {result.message}
                </p>
                <button
                  onClick={() => void navigator.clipboard.writeText(result.message)}
                  className="mt-3 h-8 rounded-md border border-line px-3 text-cap font-medium text-ink-dim transition-colors duration-150 hover:border-line-bright hover:text-ink"
                >
                  Copy message
                </button>
              </div>

              <div className="rounded-card border border-line bg-card p-4">
                <p className="flex items-center gap-1.5 text-cap font-semibold uppercase tracking-wide text-ink-faint">
                  {result.matchedKeywords.length > 0 ? (
                    <ShieldAlert size={12} className="text-danger" />
                  ) : (
                    <Lock size={12} />
                  )}
                  Content check · {verdictLabel(result.contentVerdict)}
                </p>
                {result.matchedKeywords.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.matchedKeywords.map((k) => (
                      <span
                        key={k}
                        className="rounded-full border border-danger-edge bg-danger-dim px-2 py-0.5 font-mono text-[11px] text-danger"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] leading-4 text-ink-faint">
                  Automated verdict on the decrypted text — a safety rail, not a
                  judgement.
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </section>
    </div>
  );
}

function ProbeBanner({
  probe,
  revealMode,
  onRevealMode,
}: {
  probe: AudioProbe;
  revealMode: "real" | "decoy";
  onRevealMode: (m: "real" | "decoy") => void;
}) {
  if (!probe.stegoDetected) {
    return (
      <div className="rounded-card border border-line bg-card px-4 py-3 text-body leading-5 text-ink-dim">
        No StegLab header found in this WAV. It may still contain data hidden
        by other tools — the Scanner tab can look deeper.
      </div>
    );
  }
  return (
    <div className="rounded-card border border-mint-edge bg-mint-dim px-4 py-3">
      <p className="text-body font-medium text-mint">Stego header detected</p>
      <p className="mt-0.5 text-cap text-ink-dim">
        {probe.placementMode} order
        {probe.decoyDetected ? " · contains an additional decoy message" : ""}
      </p>
      {probe.decoyDetected && (
        <div className="mt-2 flex rounded-md border border-line p-0.5">
          {(["real", "decoy"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onRevealMode(m)}
              className={`h-7 flex-1 rounded text-cap font-medium capitalize transition-colors duration-150 ${
                revealMode === m ? "bg-raise text-ink" : "text-ink-faint hover:text-ink-dim"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function verdictLabel(v: string): string {
  switch (v) {
    case "PLAIN_TEXT_MESSAGE":
      return "plain text";
    case "SCRIPT_WITH_SUSPICIOUS_INDICATORS":
      return "script with suspicious indicators";
    case "STRUCTURED_FILE":
      return "structured file content";
    case "EXECUTABLE_BINARY":
      return "executable binary";
    default:
      return "unclassified";
  }
}
