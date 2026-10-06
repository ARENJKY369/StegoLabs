"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  FileWarning,
  FlaskConical,
  RotateCcw,
  ScanLine,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import DropZone from "@/components/ui/DropZone";
import PasswordField from "@/components/ui/PasswordField";
import Tooltip from "@/components/ui/Tooltip";
import { ApiError, postForm } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { downloadScanPdf } from "@/lib/report";
import {
  TESTS,
  labelBadgeClass,
  scoreColor,
  type BatchRow,
  type ScanReport,
} from "@/lib/scanner";
import type { LoadedFile } from "./ScannerWorkbench";

interface SingleScanProps {
  loaded: LoadedFile | null;
  onLoadFile: (file: File) => Promise<void>;
  report: ScanReport | null;
  onReport: (r: ScanReport | null) => void;
  batch: BatchRow[];
  onReset: () => void;
}

export default function SingleScan({
  loaded,
  onLoadFile,
  report,
  onReport,
  batch,
  onReset,
}: SingleScanProps) {
  const [enabled, setEnabled] = useState<Set<string>>(
    new Set(TESTS.map((t) => t.id)),
  );
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const heatmapRef = useRef<HTMLCanvasElement>(null);

  const runScan = async (fileOverride?: File) => {
    const file = fileOverride ?? loaded?.file;
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await postForm<ScanReport>("/api/scan/file", {
        file,
        password: password || undefined,
        tests: Array.from(enabled).join(","),
      });
      onReport(r);
      setExpanded(r.findings[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong on our side. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const loadSample = async () => {
    setError(null);
    try {
      const res = await fetch("/samples/suspicious-sample.png");
      const blob = await res.blob();
      const file = new File([blob], "suspicious-sample.png", { type: "image/png" });
      await onLoadFile(file);
    } catch {
      setError("The bundled sample could not be loaded.");
    }
  };

  const exportJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = report.filename.replace(/\.[^.]+$/, "") + "-scanreport.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Heatmap overlay: scanned image at full opacity, block tint on top.
  useEffect(() => {
    const canvas = heatmapRef.current;
    if (!canvas || !report?.heatmapData || !loaded?.isImage) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const block = report.heatmapBlockSize;
      ctx.globalAlpha = 0.45;
      report.heatmapData!.forEach((row, by) => {
        row.forEach((frac, bx) => {
          const dist = Math.abs(frac - 0.5);
          // near-even (suspicious) → red/amber; natural imbalance → green
          const color =
            dist <= 0.03
              ? "#f04747"
              : dist <= 0.08
                ? "#f59e0b"
                : "#23d18b";
          ctx.fillStyle = color;
          ctx.fillRect(bx * block, by * block, block, block);
        });
      });
      ctx.globalAlpha = 1;
    };
    img.src = loaded.url;
  }, [report, loaded]);

  const signalBars = useMemo(() => {
    if (!report) return [];
    return report.findings
      .slice()
      .sort((a, b) => b.points - a.points)
      .map((f) => ({ name: f.name, points: f.points, id: f.id }));
  }, [report]);

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
      {/* ---------------------------------------------- left */}
      <section className="space-y-4">
        <DropZone
          onFile={(f) => void onLoadFile(f)}
          accept="*/*"
          accent="danger"
          headline="Drop any file to scan"
          note="Images, audio, documents, text — up to 50 MB"
          icon={<ScanLine size={16} strokeWidth={1.8} />}
        />

        {loaded && (
          <div className="rounded-card border border-line bg-card px-4 py-3">
            <p className="truncate text-body font-medium text-ink">{loaded.file.name}</p>
            <p className="mt-1 font-mono text-cap text-ink-faint">
              {formatBytes(loaded.file.size)}
            </p>
          </div>
        )}

        {/* test checklist */}
        <div className="rounded-card border border-line bg-card">
          <p className="border-b border-line px-3.5 py-2.5 text-cap font-semibold uppercase tracking-wide text-ink-faint">
            Active tests · {enabled.size}/9
          </p>
          <ul className="max-h-[280px] overflow-y-auto p-2">
            {TESTS.map((t) => {
              const on = enabled.has(t.id);
              return (
                <li key={t.id}>
                  <Tooltip what={t.what} when={t.when} tip={t.tip} accent="danger" side="right">
                    <button
                      onClick={() =>
                        setEnabled((prev) => {
                          const next = new Set(prev);
                          if (on) next.delete(t.id);
                          else next.add(t.id);
                          return next;
                        })
                      }
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-[7px] text-left transition-colors duration-150 hover:bg-raise"
                    >
                      <span
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors duration-150 ${
                          on ? "border-danger bg-danger" : "border-line-bright"
                        }`}
                      >
                        {on && (
                          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 5.5L4 8l4.5-6" stroke="#0a0f1a" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        )}
                      </span>
                      <span className="flex-1 text-body text-ink-dim">{t.name}</span>
                      <span
                        className={`font-mono text-[10px] ${t.deterministic ? "text-ink-faint" : "text-amber/70"}`}
                      >
                        {t.points}
                      </span>
                    </button>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-line px-3.5 py-2 text-[10px] leading-4 text-ink-faint">
            Amber point values are statistical signals — read them as hints,
            not facts.
          </p>
        </div>

        <PasswordField
          label="Password (optional — attempts extraction)"
          value={password}
          onChange={setPassword}
          placeholder="Only if you know the password"
          showMeter={false}
          autoComplete="off"
        />

        {error && (
          <div className="rounded-card border border-danger-edge bg-danger-dim px-4 py-3 text-body text-ink">
            {error}
          </div>
        )}

        <button
          onClick={() => void runScan()}
          disabled={!loaded || busy || enabled.size === 0}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-b from-danger to-[#d13838] px-4 text-body font-semibold text-white transition-all duration-150 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ScanLine size={15} />
          {busy ? "Scanning…" : "Run full scan"}
        </button>
        {busy && (
          <div className="flex items-center gap-2.5 text-cap text-ink-dim">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-danger" />
            Running {enabled.size} detection signals…
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => void loadSample()}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-line px-3 text-cap font-medium text-ink-dim transition-colors duration-150 hover:border-line-bright hover:text-ink"
          >
            <FlaskConical size={12} /> Load sample
          </button>
          <button
            onClick={() => {
              onReset();
              setPassword("");
              setError(null);
            }}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-line px-3 text-cap font-medium text-ink-dim transition-colors duration-150 hover:border-line-bright hover:text-ink"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportJson}
            disabled={!report}
            className="h-9 flex-1 rounded-md border border-line px-3 text-cap font-medium text-ink-dim transition-colors duration-150 enabled:hover:border-line-bright enabled:hover:text-ink disabled:opacity-40"
          >
            Export JSON
          </button>
          <button
            onClick={() => report && downloadScanPdf(report)}
            disabled={!report}
            className="h-9 flex-1 rounded-md border border-line px-3 text-cap font-medium text-ink-dim transition-colors duration-150 enabled:hover:border-line-bright enabled:hover:text-ink disabled:opacity-40"
          >
            Export PDF
          </button>
        </div>
      </section>

      {/* ---------------------------------------------- centre */}
      <section className="space-y-4">
        {!report ? (
          <div className="grid min-h-[300px] place-items-center rounded-card border border-line bg-card p-8">
            <div className="max-w-xs text-center">
              <FileWarning size={20} className="mx-auto text-ink-faint" strokeWidth={1.5} />
              <p className="mt-3 text-body text-ink-dim">
                No scan yet — drop a file on the left and run the full scan, or
                load the bundled sample to see what a hit looks like.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* score header */}
            <div className="rounded-card border border-line bg-card p-5">
              <div className="flex flex-wrap items-center gap-5">
                <Tooltip
                  what="A combined 0-100 score from all detection tests that fired. Below 25 is clean, 25-59 is suspicious, 60+ likely hidden."
                  when="As a quick triage number, not a final verdict."
                  tip="Always read the individual findings. Two files can score the same for completely different reasons."
                  accent="danger"
                >
                  <div
                    className="cursor-help"
                    style={{
                      // @ts-expect-error custom property feeds the glow shadow
                      "--glow-color":
                        report.score <= 24
                          ? "rgba(35,209,139,0.25)"
                          : report.score <= 59
                            ? "rgba(245,158,11,0.22)"
                            : "rgba(240,71,71,0.28)",
                    }}
                  >
                    <p
                      className={`font-mono text-[56px] font-bold leading-none tabular shadow-glow ${scoreColor(report.score)}`}
                      style={{ textShadow: "0 0 32px var(--glow-color)" }}
                    >
                      {report.score}
                    </p>
                    <p className="mt-1 text-cap text-ink-faint">risk score / 100</p>
                  </div>
                </Tooltip>
                <div className="min-w-0 flex-1">
                  <span
                    className={`inline-block rounded-full border px-3.5 py-1.5 text-cap font-semibold tracking-wide ${labelBadgeClass(report.label)}`}
                  >
                    {report.label}
                  </span>
                  <p className="mt-2 truncate text-body text-ink-dim">
                    {report.filename} · {report.detectedType} · {formatBytes(report.sizeBytes)}
                    <span className="text-ink-faint"> · scanned in {report.scanDurationMs} ms</span>
                  </p>
                  {/* gradient risk bar */}
                  <div className="relative mt-3 h-2 rounded-full bg-gradient-to-r from-mint via-amber to-danger">
                    <motion.span
                      className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-ink bg-ground"
                      animate={{ left: `calc(${Math.min(100, report.score)}% - 8px)` }}
                      transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-ink-faint">
                    <span>0 · clean</span>
                    <span>25 · suspicious</span>
                    <span>60+ · likely hidden</span>
                  </div>
                </div>
              </div>
            </div>

            {/* findings */}
            {report.findings.length === 0 ? (
              <div className="rounded-card border border-mint-edge bg-mint-dim px-4 py-3.5 text-body text-ink">
                No signals fired. Every enabled test came back negative for this file.
              </div>
            ) : (
              <div className="space-y-2.5">
                {report.findings.map((f) => {
                  const open = expanded === f.id;
                  return (
                    <div
                      key={f.id}
                      className={`overflow-hidden rounded-card border border-line bg-card border-l-[3px] ${
                        f.deterministic ? "border-l-danger" : "border-l-amber"
                      }`}
                    >
                      <button
                        onClick={() => setExpanded(open ? null : f.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      >
                        <span className="flex-1 text-body font-semibold text-ink">{f.name}</span>
                        <span
                          className={`rounded-md px-2 py-0.5 font-mono text-cap font-semibold ${
                            f.deterministic
                              ? "bg-danger-dim text-danger"
                              : "bg-amber-dim text-amber"
                          }`}
                        >
                          +{f.points}
                        </span>
                        <ChevronDown
                          size={14}
                          className={`text-ink-faint transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                        />
                      </button>
                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.16 }}
                          >
                            <div className="border-t border-line px-4 py-3">
                              <p className="text-body leading-5 text-ink-dim">{f.detail}</p>
                              <code className="mt-2 block rounded bg-raise px-2.5 py-1.5 font-mono text-[11px] text-ink-faint">
                                {f.technical}
                              </code>
                              <p className="mt-1.5 text-[10px] text-ink-faint">
                                {f.deterministic
                                  ? "Deterministic signal — this is a structural fact."
                                  : "Statistical signal — probabilistic, read alongside the others."}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}

            {/* classification panels */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-card border border-line bg-card p-4">
                <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
                  Payload classification · blind
                </p>
                {report.payloadClassification ? (
                  <dl className="mt-3 space-y-2 text-body">
                    <KV k="Structural type" v={report.payloadClassification.structuralType} />
                    <KV k="Entropy" v={`${report.payloadClassification.entropy.toFixed(2)} bits/byte`} />
                    <KV k="Confidence" v={`${Math.round(report.payloadClassification.confidence * 100)}%`} />
                    <KV k="Offset" v={`byte ${report.payloadClassification.offset}`} />
                  </dl>
                ) : (
                  <p className="mt-3 text-body text-ink-faint">
                    No appended or embedded payload structure detected.
                  </p>
                )}
              </div>
              <div className="rounded-card border border-line bg-card p-4">
                <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
                  Payload classification · authenticated
                </p>
                {report.authenticatedClassification ? (
                  <div className="mt-3 space-y-2.5">
                    <span className="inline-block rounded-full border border-azure-edge bg-azure-dim px-3 py-1 text-cap font-medium text-azure">
                      {report.authenticatedClassification.contentVerdict?.replaceAll("_", " ")}
                    </span>
                    {report.authenticatedClassification.matchedKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {report.authenticatedClassification.matchedKeywords.map((k) => (
                          <code key={k} className="rounded-full border border-danger-edge bg-danger-dim px-2 py-0.5 font-mono text-[10px] text-danger">
                            {k}
                          </code>
                        ))}
                      </div>
                    )}
                    {report.extractedPreview && (
                      <code className="block rounded bg-raise px-2.5 py-1.5 font-mono text-[11px] text-ink-dim">
                        {report.extractedPreview}
                      </code>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-body text-ink-faint">
                    {password
                      ? "The password did not unlock a payload in this file."
                      : "Provide a password on the left to attempt extraction during the scan."}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* ---------------------------------------------- right */}
      <section className="space-y-4">
        <div className="rounded-card border border-line bg-card p-3.5">
          <Tooltip
            what="Each 20×20 pixel block is tinted by how evenly split its lowest bits are."
            when="Finding WHERE in the image hidden data sits — sequential embedding shows as a red band from the top."
            tip="Red means near-perfect 50/50 bits, amber is borderline, green is natural imbalance."
            accent="danger"
          >
            <p className="inline-block cursor-help text-cap font-semibold uppercase tracking-wide text-ink-faint underline decoration-dotted decoration-ink-faint underline-offset-2">
              LSB heatmap overlay
            </p>
          </Tooltip>
          {report?.heatmapData && loaded?.isImage ? (
            <>
              <canvas
                ref={heatmapRef}
                className="mt-2.5 w-full rounded"
                style={{ imageRendering: "pixelated", maxHeight: 240 }}
              />
              <div className="mt-2 flex items-center gap-3 text-[10px] text-ink-faint">
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-mint inline-block" /> natural</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-amber inline-block" /> near-even</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-danger inline-block" /> suspicious</span>
              </div>
            </>
          ) : (
            <p className="mt-2 text-cap text-ink-faint">
              Scan an image to overlay its block-level LSB balance here.
            </p>
          )}
        </div>

        <div className="rounded-card border border-line bg-card p-3.5">
          <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
            Per-signal breakdown
          </p>
          {signalBars.length > 0 ? (
            <div className="mt-2.5 space-y-2">
              {signalBars.map((s) => (
                <div key={s.id}>
                  <div className="flex justify-between text-[10px] text-ink-faint">
                    <span className="truncate">{s.name}</span>
                    <span className="font-mono">+{s.points}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-line">
                    <motion.div
                      className="h-full rounded-full bg-danger"
                      initial={{ width: 0 }}
                      animate={{ width: `${(s.points / 40) * 100}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-cap text-ink-faint">
              Signal contributions appear after a scan.
            </p>
          )}
        </div>

        <div className="rounded-card border border-line bg-card p-3.5">
          <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
            Batch results
          </p>
          {batch.length > 0 ? (
            <ul className="mt-2 max-h-[180px] space-y-1 overflow-y-auto">
              {batch.slice(0, 20).map((row, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-cap">
                  <span className="truncate text-ink-dim">{row.filename}</span>
                  <span className={`font-mono tabular ${scoreColor(row.score)}`}>
                    {row.score < 0 ? "ERR" : row.score}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-cap text-ink-faint">
              Run a batch on the Batch folder tab — a summary lands here.
            </p>
          )}
        </div>

        {report && (
          <div className="rounded-card border border-line bg-card p-3.5">
            <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
              Session report
            </p>
            <p className="mt-1.5 text-cap text-ink-dim">
              1 file scanned · {report.findings.length} finding{report.findings.length === 1 ? "" : "s"} ·
              score {report.score}
            </p>
            <button
              onClick={exportJson}
              className="mt-2.5 h-8 w-full rounded-md border border-line text-cap font-medium text-ink-dim transition-colors duration-150 hover:border-line-bright hover:text-ink"
            >
              Export session JSON
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-cap text-ink-faint">{k}</dt>
      <dd className="text-right font-mono text-[12px] text-ink tabular">{v}</dd>
    </div>
  );
}
