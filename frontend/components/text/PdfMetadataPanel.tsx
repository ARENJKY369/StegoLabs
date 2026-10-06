"use client";

import { useState } from "react";
import { Download, FileText, HelpCircle, KeyRound, Unlock } from "lucide-react";
import { motion } from "framer-motion";
import DropZone from "@/components/ui/DropZone";
import PasswordField from "@/components/ui/PasswordField";
import Tooltip from "@/components/ui/Tooltip";
import { ApiError, postForm, postFormForFile } from "@/lib/api";
import { formatBytes } from "@/lib/format";

interface PdfMessage {
  message: string;
  revealMode: string;
  decoyPresent: boolean;
  contentVerdict: string;
  matchedKeywords: string[];
}

/**
 * Documents · PDF metadata. A metadata technique, shown with its honesty
 * label: anyone with a properties inspector can see the custom field,
 * and Clean & Verify strips it outright.
 */
export default function PdfMetadataPanel() {
  const [mode, setMode] = useState<"hide" | "extract">("hide");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [decoyOn, setDecoyOn] = useState(false);
  const [decoyMessage, setDecoyMessage] = useState("");
  const [decoyPassword, setDecoyPassword] = useState("");
  const [revealMode, setRevealMode] = useState<"real" | "decoy">("real");
  const [probe, setProbe] = useState<{ stegoDetected: boolean; decoyDetected?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [result, setResult] = useState<PdfMessage | null>(null);
  const [out, setOut] = useState<{ url: string; name: string } | null>(null);

  const inputCls =
    "w-full rounded-md border border-line bg-ground px-3 py-2 text-body text-ink placeholder:text-ink-faint focus:border-line-bright focus:outline-none";

  const accept = async (f: File) => {
    setError(null);
    setResult(null);
    setOut(null);
    setProbe(null);
    setRevealMode("real");
    setFile(f);
    if (mode === "extract") {
      try {
        setProbe(
          await postForm<{ stegoDetected: boolean; decoyDetected?: boolean }>(
            "/api/extract/pdf/probe",
            { file: f },
          ),
        );
      } catch {
        setProbe(null);
      }
    }
  };

  const run = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setErrorCode(null);
    setResult(null);
    setOut(null);
    try {
      if (mode === "hide") {
        const { blob, filename } = await postFormForFile<object>("/api/hide/pdf", {
          file,
          message,
          password,
          decoyMessage: decoyOn ? decoyMessage : undefined,
          decoyPassword: decoyOn ? decoyPassword : undefined,
        });
        setOut({ url: URL.createObjectURL(blob), name: filename ?? "document-stego.pdf" });
      } else {
        const res = await postForm<PdfMessage>("/api/extract/pdf", {
          file,
          password,
          revealMode,
        });
        setResult(res);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setErrorCode(e.code);
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  };

  const canRun =
    file !== null &&
    password.length > 0 &&
    (mode === "extract" ||
      (message.trim().length > 0 &&
        message.length <= 2000 &&
        (!decoyOn || (decoyMessage.trim().length > 0 && decoyPassword.length > 0 && decoyPassword !== password))));

  return (
    <div className="mt-8 rounded-card border border-line bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <FileText size={17} className="text-amber" strokeWidth={1.8} />
          <div>
            <h2 className="text-section text-ink">Documents · PDF metadata</h2>
            <p className="text-cap text-ink-faint">
              A label, not a hiding place — properties inspectors can see the
              field exists, and Clean &amp; Verify strips it outright
            </p>
          </div>
          <Tooltip
            what="The encrypted message is stored as a custom document property inside the PDF, not in its content."
            when="Short labels and dead-drop notes that travel with a document and look like ordinary metadata."
            tip="Anything in metadata is visible to forensic tools. For content-level hiding, use zero-width text inside the document itself."
            accent="amber"
          >
            <HelpCircle size={13} className="text-ink-faint" />
          </Tooltip>
        </div>
        <div className="flex rounded-lg border border-line bg-card p-0.5">
          {(["hide", "extract"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
                setResult(null);
                setOut(null);
                setFile(null);
                setProbe(null);
              }}
              className={`relative rounded-md px-4 py-1.5 text-body font-medium capitalize transition-colors duration-150 ${
                mode === m ? "text-ink" : "text-ink-faint hover:text-ink-dim"
              }`}
            >
              {mode === m && (
                <motion.span
                  layoutId="pdf-mode-pill"
                  className="absolute inset-0 rounded-md bg-raise"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative">{m}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <section className="space-y-4">
          <DropZone
            onFile={(f) => void accept(f)}
            accept=".pdf,application/pdf"
            accent="amber"
            headline="Drop a PDF"
            note={mode === "hide" ? "The property is written into it without touching its pages" : "It is probed for a metadata message first"}
            icon={<FileText size={16} strokeWidth={1.8} />}
            compact={file !== null}
          />
          {file && (
            <div className="rounded-card border border-line bg-ground p-3">
              <p className="truncate text-body font-medium text-ink">{file.name}</p>
              <p className="font-mono text-[11px] text-ink-faint">{formatBytes(file.size)}</p>
            </div>
          )}

          {mode === "extract" && probe && (
            <div className={`rounded-card border px-4 py-3 ${probe.stegoDetected ? "border-mint-edge bg-mint-dim" : "border-line bg-card"}`}>
              {probe.stegoDetected ? (
                <>
                  <p className="text-body font-medium text-mint">Metadata message detected</p>
                  {probe.decoyDetected && (
                    <>
                      <p className="mt-0.5 text-cap text-ink-dim">Contains an additional decoy layer.</p>
                      <div className="mt-2 flex rounded-md border border-line p-0.5">
                        {(["real", "decoy"] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setRevealMode(m)}
                            className={`h-7 flex-1 rounded text-cap font-medium capitalize transition-colors duration-150 ${
                              revealMode === m ? "bg-raise text-ink" : "text-ink-faint hover:text-ink-dim"
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="text-body text-ink-dim">No metadata message in this document.</p>
              )}
            </div>
          )}

          {mode === "hide" && (
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
                  Message
                </label>
                <span className="font-mono text-[11px] tabular text-ink-faint">
                  {message.length}/2000
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Short label, note or reference…"
                className={`${inputCls} resize-none`}
              />
            </div>
          )}

          <PasswordField label="Password" value={password} onChange={setPassword} showMeter={mode === "hide"} />

          {mode === "hide" && decoyOn && (
            <div className="space-y-2">
              <textarea
                value={decoyMessage}
                onChange={(e) => setDecoyMessage(e.target.value)}
                rows={2}
                placeholder="The innocent decoy…"
                className={`${inputCls} resize-none`}
              />
              <PasswordField label="Decoy password" value={decoyPassword} onChange={setDecoyPassword} />
            </div>
          )}
          {mode === "hide" && (
            <label className="flex cursor-pointer items-center justify-between text-cap text-ink-dim">
              <span>Decoy message</span>
              <button
                onClick={() => setDecoyOn((v) => !v)}
                className={`relative h-5 w-9 rounded-full transition-colors duration-150 ${decoyOn ? "bg-amber" : "bg-line"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-transform duration-150 ${decoyOn ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </label>
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
                ? "Wrong password — or the document was modified. Both look identical by design."
                : error}
            </div>
          )}

          <button
            onClick={() => void run()}
            disabled={!canRun || busy}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-b from-amber to-[#e08a00] px-4 text-body font-semibold text-ground transition-all duration-150 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <KeyRound size={15} />
            {busy ? "Working…" : mode === "hide" ? "Write into metadata" : "Read from metadata"}
          </button>
        </section>

        <section>
          {!result && !out ? (
            <div className="grid min-h-[220px] place-items-center rounded-card border border-line bg-ground p-6">
              <p className="max-w-xs text-center text-body text-ink-dim">
                {mode === "hide"
                  ? "The modified PDF returns here for download — its pages untouched, one extra property inside."
                  : "Drop a document; if a StegLab property exists, the password unlocks its contents here."}
              </p>
            </div>
          ) : out ? (
            <div className="space-y-4">
              <div className="rounded-card border border-mint-edge bg-mint-dim px-4 py-3">
                <p className="text-body font-medium text-mint">Written — {out.name}</p>
                <p className="mt-0.5 text-cap text-ink-dim">
                  Pages untouched · one custom document property added
                </p>
              </div>
              <a
                href={out.url}
                download={out.name}
                className="flex h-10 items-center justify-center gap-2 rounded-md bg-gradient-to-b from-amber to-[#e08a00] px-4 text-body font-semibold text-ground transition-all duration-150 hover:brightness-110"
              >
                <Download size={15} /> Download stego PDF
              </a>
            </div>
          ) : (
            result && (
              <div className="space-y-4">
                <div className="rounded-card border border-mint-edge bg-mint-dim px-4 py-3">
                  <p className="flex items-center gap-2 text-body font-medium text-mint">
                    <Unlock size={14} /> Message recovered
                    {result.revealMode === "decoy" && (
                      <span className="text-cap text-ink-dim">· DECOY layer</span>
                    )}
                  </p>
                </div>
                <div className="rounded-card border border-line bg-card p-4">
                  <p className="whitespace-pre-wrap break-words text-body leading-6 text-ink">
                    {result.message}
                  </p>
                  <button
                    onClick={() => void navigator.clipboard.writeText(result.message)}
                    className="mt-3 h-8 rounded-md border border-line px-3 text-cap font-medium text-ink-dim transition-colors duration-150 hover:border-line-bright hover:text-ink"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )
          )}
        </section>
      </div>
    </div>
  );
}
