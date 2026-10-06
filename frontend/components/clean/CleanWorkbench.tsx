"use client";

import { useState } from "react";
import { Download, Eraser, FileCheck2, HelpCircle, Radar, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import DropZone from "@/components/ui/DropZone";
import Tooltip from "@/components/ui/Tooltip";
import { ApiError, postForm, postFormForFile } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { cleanability, type CleanReport } from "@/lib/clean";
import { scoreColor, type ScanReport } from "@/lib/scanner";

type Profile = "standard" | "deep";

interface Outcome {
  url: string;
  name: string;
  report: CleanReport;
  bytes: ArrayBuffer;
}

export default function CleanWorkbench() {
  const [file, setFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<Profile>("standard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [beforeScan, setBeforeScan] = useState<ScanReport | null>(null);
  const [afterScan, setAfterScan] = useState<ScanReport | null>(null);
  const [scanning, setScanning] = useState<"before" | "after" | null>(null);

  const hint = file ? cleanability(file) : null;
  const deepEligible = hint?.kind === "ok" && (hint.typeLabel === "Image" || hint.typeLabel === "WAV audio");

  const accept = async (f: File) => {
    setError(null);
    setOutcome(null);
    setBeforeScan(null);
    setAfterScan(null);
    if (!cleanability(f).kind.includes("blocked") && f.size <= 50 * 1024 * 1024) {
      setScanning("before");
      try {
        setBeforeScan(await postForm<ScanReport>("/api/scan/file", { file: f }));
      } catch {
        /* baseline scan is advisory; cleaning must still work */
      } finally {
        setScanning(null);
      }
    }
    setFile(f);
  };

  const run = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setOutcome(null);
    setAfterScan(null);
    try {
      const useProfile = profile === "deep" && !deepEligible ? "standard" : profile;
      const { blob, meta, filename } = await postFormForFile<CleanReport>("/api/clean/file", {
        file,
        profile: useProfile,
      });
      const bytes = await blob.arrayBuffer();
      setOutcome({ url: URL.createObjectURL(blob), name: filename ?? `clean-${file.name}`, report: meta, bytes });
      // Verify pass: scan the cleaned file so the delta is proof, not hope.
      setScanning("after");
      try {
        setAfterScan(
          await postForm<ScanReport>("/api/scan/file", {
            file: new Blob([bytes], { type: blob.type }),
          }),
        );
      } catch {
        /* advisory */
      } finally {
        setScanning(null);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong while cleaning.");
    } finally {
      setBusy(false);
    }
  };

  const riskBadge = (r: string) =>
    r === "LOW"
      ? "border-mint-edge bg-mint-dim text-mint"
      : r === "REDUCED"
        ? "border-amber-edge bg-amber-dim text-amber"
        : "border-danger-edge bg-danger-dim text-danger";

  const delta =
    beforeScan && afterScan ? afterScan.score - beforeScan.score : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* ================= left ================= */}
      <section className="space-y-4">
        <DropZone
          onFile={(f) => void accept(f)}
          accept="*/*"
          accent="mint"
          headline="Drop a file to clean"
          note="Image, WAV, PDF, ZIP or text"
          icon={<Sparkles size={16} strokeWidth={1.8} />}
          compact={file !== null}
        />

        {file && hint && (
          <div className="rounded-card border border-line bg-card p-3.5">
            <p className="truncate text-body font-medium text-ink">{file.name}</p>
            <p className="mt-1 font-mono text-[11px] text-ink-faint">
              {hint.typeLabel} · {formatBytes(file.size)}
            </p>
            {hint.kind !== "ok" && (
              <p className="mt-2 rounded-md border border-amber-edge bg-amber-dim px-2.5 py-1.5 text-cap leading-4 text-ink">
                {hint.why}
              </p>
            )}
          </div>
        )}

        {file && (
          <div className="space-y-2">
            <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">Profile</p>
            {(
              [
                [
                  "standard",
                  "Standard",
                  "Metadata strip",
                  "Drops metadata blocks, appends and container junk. Every pixel and sample stays bit-identical.",
                  "The everyday wipe before sharing a file: EXIF, authors, tool fingerprints, comments are gone; the content is untouched.",
                  "LSB-hidden data SURVIVES this profile — it lives in the pixels, not the metadata.",
                ],
                [
                  "deep",
                  "Deep",
                  "Metadata + signal scrub",
                  "Everything standard does, plus randomises the lowest bit of every pixel/sample.",
                  "When the file iteself may be a carrier and you must be sure any embedded channel is destroyed.",
                  deepEligible
                    ? "Imperceptible to eye and ear — but unequivocally fatal to LSB payloads."
                    : "LSB scrub applies to images & WAV only — this file gets the standard strip.",
                ],
              ] as [Profile, string, string, string, string, string][]
            ).map(([p, label, sub, what, when, tip]) => (
              <button
                key={p}
                onClick={() => setProfile(p)}
                className={`w-full rounded-card border p-3 text-left transition-colors duration-150 ${
                  profile === p ? "border-mint-edge bg-mint-dim" : "border-line bg-card hover:border-line-bright"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-body font-medium text-ink">
                    {label} <span className="text-cap text-ink-faint">· {sub}</span>
                  </p>
                  <Tooltip what={what} when={when} tip={tip} accent="mint">
                    <HelpCircle size={13} className="text-ink-faint" />
                  </Tooltip>
                </div>
                <p className="mt-1 text-cap leading-4 text-ink-faint">{tip}</p>
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-card border border-danger-edge bg-danger-dim px-4 py-3 text-body text-ink">
            {error}
          </div>
        )}

        <button
          onClick={() => void run()}
          disabled={!file || busy || hint?.kind === "blocked"}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-b from-mint to-[#1cb87c] px-4 text-body font-semibold text-ground transition-all duration-150 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Eraser size={15} />
          {busy ? "Cleaning…" : "Clean & verify"}
        </button>
        {file && beforeScan && (
          <p className="text-center text-[11px] text-ink-faint">
            Baseline scan:{" "}
            <span className={`font-mono font-semibold ${scoreColor(beforeScan.score)}`}>
              {beforeScan.score}/100
            </span>{" "}
            · the cleaned file is re-scanned automatically
          </p>
        )}
      </section>

      {/* ================= right ================= */}
      <section>
        {!outcome ? (
          <div className="grid min-h-[300px] place-items-center rounded-card border border-line bg-card p-8">
            <div className="max-w-md text-center">
              <FileCheck2 className="mx-auto text-mint" size={28} strokeWidth={1.5} />
              <h3 className="mt-3 text-section text-ink">Clean, then prove it</h3>
              <p className="mt-2 text-body text-ink-dim">
                StegLab rebuilds your file without its metadata, appended data
                or active content — and automatically re-scans the result so
                you see the risk score drop, not just trust it.
              </p>
              <div className="mx-auto mt-4 max-w-sm rounded-card border border-line bg-ground p-3.5 text-left text-cap leading-5 text-ink-dim">
                <p className="font-semibold uppercase tracking-wide text-ink-faint">
                  What &quot;clean&quot; honestly means
                </p>
                <p className="mt-1.5">
                  Content bytes are never rewritten beyond the scrub — a 0
                  score afterwards means <em>no signal our nine tests can
                  find</em>, not a mathematical proof of absence.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-mint-edge bg-mint-dim px-4 py-3">
                <div>
                  <p className="text-body font-medium text-mint">Cleaned — {outcome.name}</p>
                  <p className="mt-0.5 text-cap text-ink-dim">
                    {outcome.report.fileType} · {outcome.report.profile} profile
                  </p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${riskBadge(outcome.report.residualRisk)}`}>
                  Residual risk: {outcome.report.residualRisk}
                </span>
              </div>

              {/* score delta */}
              <div className="rounded-card border border-line bg-card p-4">
                <p className="flex items-center gap-1.5 text-cap font-semibold uppercase tracking-wide text-ink-faint">
                  <Radar size={12} /> Scanner verification
                </p>
                <div className="mt-3 flex items-end justify-around">
                  <ScoreBlock label="Before" report={beforeScan} busy={scanning === "before"} />
                  <div className="pb-6 text-center">
                    {delta !== null ? (
                      <motion.p
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`font-mono text-xl font-bold ${delta < 0 ? "text-mint" : "text-ink-faint"}`}
                      >
                        {delta < 0 ? delta : "±0"}
                      </motion.p>
                    ) : (
                      <p className="font-mono text-xl text-ink-faint">…</p>
                    )}
                    <p className="text-[10px] text-ink-faint">score change</p>
                  </div>
                  <ScoreBlock label="After clean" report={afterScan} busy={scanning === "after"} />
                </div>
                {delta === 0 && beforeScan && beforeScan.score === 0 && (
                  <p className="text-center text-cap text-ink-faint">The original was already clean — nothing changed.</p>
                )}
                {delta !== null && delta < 0 && (
                  <p className="text-center text-cap text-mint">
                    {Math.abs(delta)} points of detectable risk removed.
                  </p>
                )}
              </div>

              {/* removal ledger */}
              <div className="rounded-card border border-line bg-card">
                <div className="border-b border-line px-4 py-2.5">
                  <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
                    What was removed · {formatBytes(outcome.report.beforeBytes)} → {formatBytes(outcome.report.afterBytes)}
                  </p>
                </div>
                <ul className="divide-y divide-line/60">
                  {outcome.report.itemsRemoved.map((item, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                      <div>
                        <p className="text-body font-medium text-ink">{item.category}</p>
                        <p className="text-cap text-ink-faint">{item.detail}</p>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-mint tabular">
                        {item.category === "Container" || item.category === "Appended data"
                          ? formatBytes(item.count)
                          : `×${item.count.toLocaleString()}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {outcome.report.notes.length > 0 && (
                <ul className="space-y-1.5">
                  {outcome.report.notes.map((n, i) => (
                    <li key={i} className="rounded-md border border-line bg-ground px-3 py-2 text-cap leading-4 text-ink-dim">
                      {n}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2">
                <a
                  href={outcome.url}
                  download={outcome.name}
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-gradient-to-b from-mint to-[#1cb87c] px-4 text-body font-semibold text-ground transition-all duration-150 hover:brightness-110"
                >
                  <Download size={15} /> Download cleaned file
                </a>
                <button
                  onClick={() => {
                    setOutcome(null);
                    setFile(null);
                    setBeforeScan(null);
                    setAfterScan(null);
                  }}
                  className="h-10 rounded-md border border-line px-4 text-cap font-medium text-ink-dim transition-colors duration-150 hover:border-line-bright hover:text-ink"
                >
                  Clean another
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </section>
    </div>
  );
}

function ScoreBlock({ label, report, busy }: { label: string; report: ScanReport | null; busy: boolean }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      {busy ? (
        <p className="mt-1 font-mono text-2xl text-ink-faint">…</p>
      ) : report ? (
        <p className={`mt-1 font-mono text-3xl font-bold tabular ${scoreColor(report.score)}`}>
          {report.score}
        </p>
      ) : (
        <p className="mt-1 font-mono text-2xl text-ink-faint">—</p>
      )}
      <p className="mt-0.5 text-[10px] text-ink-faint">{report?.label?.split(" ")[0] ?? "not scanned"}</p>
    </div>
  );
}
