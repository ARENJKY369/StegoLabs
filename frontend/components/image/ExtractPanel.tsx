"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  FileSearch,
  KeyRound,
  ShieldAlert,
  ShieldQuestion,
} from "lucide-react";
import DropZone from "@/components/ui/DropZone";
import PasswordField from "@/components/ui/PasswordField";
import Tooltip from "@/components/ui/Tooltip";
import { ApiError, postForm } from "@/lib/api";
import { formatBytes } from "@/lib/format";

interface ProbeResult {
  stegoDetected: boolean;
  placementMode?: string;
  decoyDetected?: boolean;
  bitDepth?: number;
}

interface Classification {
  mode: string;
  structuralType: string;
  entropy: number;
  confidence: number;
}

interface ExtractResponse {
  message: string;
  placementMode: string;
  revealMode: string;
  decoyPresent: boolean;
  bitDepth: number;
  channels: string;
  payloadClassification: Classification;
  contentVerdict: string | null;
  matchedKeywords: string[];
  entropy: number;
}

const VERDICT_LABELS: Record<string, { label: string; tone: "ok" | "warn" | "bad" }> = {
  PLAIN_TEXT_MESSAGE: { label: "Plain text message", tone: "ok" },
  STRUCTURED_FILE: { label: "Structured file", tone: "warn" },
  SCRIPT_WITH_SUSPICIOUS_INDICATORS: { label: "Script with suspicious indicators", tone: "bad" },
  EXECUTABLE_BINARY: { label: "Executable binary", tone: "bad" },
  UNKNOWN_BINARY: { label: "Unknown binary", tone: "warn" },
};

export default function ExtractPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [password, setPassword] = useState("");
  const [revealMode, setRevealMode] = useState<"real" | "decoy">("real");
  const [busy, setBusy] = useState(false);
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState<{ text: string; code: string } | null>(null);
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const acceptFile = async (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    setProbe(null);
    setRevealMode("real");
    setProbing(true);
    try {
      const p = await postForm<ProbeResult>("/api/extract/image/probe", { file: f });
      setProbe(p);
    } catch (e) {
      // Probe failures are not fatal — extraction itself will explain.
      if (e instanceof ApiError) setError({ text: e.message, code: e.code });
    } finally {
      setProbing(false);
    }
  };

  const extract = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await postForm<ExtractResponse>("/api/extract/image", {
        file,
        password,
        revealMode,
      });
      setResult(r);
    } catch (e) {
      if (e instanceof ApiError) setError({ text: e.message, code: e.code });
      else setError({ text: "Something went wrong on our side. Please try again.", code: "UNKNOWN" });
    } finally {
      setBusy(false);
    }
  };

  const copyMessage = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const verdict = result?.contentVerdict ? VERDICT_LABELS[result.contentVerdict] : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* ---------------------------------------------- left: input */}
      <section className="space-y-4">
        <DropZone
          onFile={acceptFile}
          accept=".png,.bmp,image/png,image/bmp"
          accent="teal"
          headline="Drop the stego image here"
          note="The PNG or BMP that carries the hidden message"
          icon={<FileSearch size={16} strokeWidth={1.8} />}
        />

        {file && (
          <div className="rounded-card border border-line bg-card px-4 py-3">
            <p className="truncate text-body font-medium text-ink">{file.name}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-cap text-ink-faint">
              <span>{formatBytes(file.size)}</span>
              {probing && <span className="text-azure">probing header…</span>}
            </div>
            {probe && (
              <div className="mt-2.5 space-y-1.5 border-t border-line pt-2.5 text-cap">
                {probe.stegoDetected ? (
                  <>
                    <Row k="Stego header" v="found" tone="ok" />
                    <Row k="Placement" v={probe.placementMode ?? "—"} />
                    <Row k="Bit depth" v={`${probe.bitDepth}-bit`} />
                    {probe.decoyDetected && <Row k="Decoy" v="present" tone="warn" />}
                  </>
                ) : (
                  <Row k="Stego header" v="not found" tone="bad" />
                )}
              </div>
            )}
          </div>
        )}

        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="The password used when hiding"
          showMeter={false}
          autoComplete="off"
        />

        {probe?.decoyDetected && (
          <div className="rounded-card border border-line bg-card p-3.5">
            <Tooltip
              what="This file holds two messages. Choose which one your password should unlock."
              when="Pick 'real' with the real password, or 'decoy' with the decoy password."
              tip="Each message only opens with its own password — the other one simply fails."
              accent="teal"
            >
              <p className="inline-block cursor-help text-cap font-medium text-ink-dim underline decoration-dotted decoration-ink-faint underline-offset-2">
                Reveal mode
              </p>
            </Tooltip>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-md border border-line bg-raise p-0.5">
              {(["real", "decoy"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setRevealMode(m)}
                  className={`rounded px-2 py-1.5 text-cap font-medium capitalize transition-colors duration-150 ${
                    revealMode === m
                      ? "bg-teal-dim text-teal"
                      : "text-ink-faint hover:text-ink-dim"
                  }`}
                >
                  {m} message
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={extract}
          disabled={!file || !password || busy}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-b from-teal to-[#0bb3a2] px-4 text-body font-semibold text-ground transition-all duration-150 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <KeyRound size={15} />
          {busy ? "Decrypting…" : "Extract message"}
        </button>

        {busy && (
          <div className="flex items-center gap-2.5 text-cap text-ink-dim">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-teal" />
            Deriving key and decrypting…
          </div>
        )}
      </section>

      {/* ---------------------------------------------- right: output */}
      <section className="space-y-4">
        {error && (
          <div
            className={`flex items-start gap-3 rounded-card border px-4 py-3.5 ${
              error.code === "WRONG_PASSWORD"
                ? "border-danger-edge bg-danger-dim"
                : "border-amber-edge bg-amber-dim"
            }`}
          >
            <ShieldAlert
              size={16}
              className={`mt-0.5 shrink-0 ${error.code === "WRONG_PASSWORD" ? "text-danger" : "text-amber"}`}
            />
            <div>
              <p className="text-body font-medium text-ink">{error.text}</p>
              <p className="mt-1 text-cap text-ink-dim">
                {error.code === "WRONG_PASSWORD"
                  ? "Check for typos and keyboard layout. If the password is definitely right, the file was altered after hiding — even one re-save can do it."
                  : error.code === "NO_HIDDEN_DATA"
                    ? "Make sure this is the exact file produced by the hide step, not a copy that went through a messenger or editor."
                    : "If this keeps happening, try re-uploading the original file."}
              </p>
            </div>
          </div>
        )}

        {/* extracted message */}
        <div className="rounded-card border border-line bg-card">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
              Extracted message
            </p>
            {result && (
              <div className="flex items-center gap-2">
                {result.revealMode === "decoy" && (
                  <span className="rounded-full border border-amber-edge bg-amber-dim px-2 py-0.5 text-cap text-amber">
                    decoy
                  </span>
                )}
                <button
                  onClick={copyMessage}
                  className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-cap text-ink-dim transition-colors duration-150 hover:border-line-bright hover:text-ink"
                >
                  {copied ? <Check size={11} className="text-mint" /> : <Copy size={11} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>
          {result ? (
            <textarea
              readOnly
              value={result.message}
              rows={Math.min(14, Math.max(4, result.message.split("\n").length + 1))}
              className="w-full resize-y bg-transparent px-4 py-3 font-mono text-[13px] leading-6 text-ink focus:outline-none"
            />
          ) : (
            <div className="grid min-h-[160px] place-items-center px-6 text-center">
              <div>
                <ShieldQuestion size={18} className="mx-auto text-ink-faint" strokeWidth={1.5} />
                <p className="mt-2 text-cap text-ink-faint">
                  Nothing extracted yet — load the stego image, enter the password
                  and press Extract.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* classification */}
        {result && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-card border border-line bg-card p-4">
              <Tooltip
                what="What the raw hidden bytes look like before decryption — judged purely by structure, with no password involved."
                when="Useful to an analyst who intercepts a file but has no password."
                tip="StegLab never labels a payload 'malicious' or 'safe' — it reports what the bytes are, you judge the context."
                accent="teal"
              >
                <p className="inline-block cursor-help text-cap font-semibold uppercase tracking-wide text-ink-faint underline decoration-dotted decoration-ink-faint underline-offset-2">
                  Blind classification
                </p>
              </Tooltip>
              <dl className="mt-3 space-y-2 text-body">
                <Row k="Structural type" v={result.payloadClassification.structuralType} />
                <Row
                  k="Ciphertext entropy"
                  v={`${result.payloadClassification.entropy.toFixed(2)} bits/byte`}
                />
                <Row
                  k="Confidence"
                  v={`${Math.round(result.payloadClassification.confidence * 100)}%`}
                />
              </dl>
              <p className="mt-3 text-cap leading-4 text-ink-faint">
                Entropy near 8.0 means the ciphertext is statistically
                indistinguishable from random noise — exactly what AES-GCM
                should produce.
              </p>
            </div>

            <div className="rounded-card border border-line bg-card p-4">
              <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
                Authenticated classification
              </p>
              {verdict && (
                <span
                  className={`mt-3 inline-block rounded-full border px-3 py-1 text-cap font-medium ${
                    verdict.tone === "ok"
                      ? "border-mint-edge bg-mint-dim text-mint"
                      : verdict.tone === "warn"
                        ? "border-amber-edge bg-amber-dim text-amber"
                        : "border-danger-edge bg-danger-dim text-danger"
                  }`}
                >
                  {verdict.label}
                </span>
              )}
              {result.matchedKeywords.length > 0 && (
                <div className="mt-3">
                  <p className="text-cap text-ink-faint">Matched indicators</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {result.matchedKeywords.map((k) => (
                      <code
                        key={k}
                        className="rounded-full border border-danger-edge bg-danger-dim px-2 py-0.5 font-mono text-[10px] text-danger"
                      >
                        {k}
                      </code>
                    ))}
                  </div>
                </div>
              )}
              <dl className="mt-3 space-y-2 text-body">
                <Row k="Plaintext entropy" v={`${result.entropy.toFixed(2)} bits/byte`} />
                <Row k="Placement" v={result.placementMode} />
                <Row k="Channels · depth" v={`${result.channels} · ${result.bitDepth}-bit`} />
              </dl>
              {result.matchedKeywords.length > 0 && (
                <p className="mt-3 text-cap leading-4 text-ink-dim">
                  These patterns are common in download-and-execute scripts.
                  That does not prove bad intent — but treat the content with
                  care before running anything.
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Row({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: "ok" | "warn" | "bad";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-cap text-ink-faint">{k}</dt>
      <dd
        className={`text-right font-mono text-[12px] tabular ${
          tone === "ok"
            ? "text-mint"
            : tone === "warn"
              ? "text-amber"
              : tone === "bad"
                ? "text-danger"
                : "text-ink"
        }`}
      >
        {v}
      </dd>
    </div>
  );
}
