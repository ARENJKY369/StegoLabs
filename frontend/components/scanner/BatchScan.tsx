"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowUpDown, FolderSearch, Search } from "lucide-react";
import { motion } from "framer-motion";
import DropZone from "@/components/ui/DropZone";
import { formatBytes } from "@/lib/format";
import { labelBadgeClass, scoreColor, type BatchRow } from "@/lib/scanner";

interface BatchScanProps {
  rows: BatchRow[];
  onRows: (rows: BatchRow[]) => void;
  onInspect: (file: File) => Promise<void>;
}

type SortKey = "filename" | "score" | "sizeBytes" | "type";

const CHUNK = 5; // files per request → real progress, bounded memory

export default function BatchScan({ rows, onRows, onInspect }: BatchScanProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);
  const fileMap = useRef<Map<string, File>>(new Map());

  const addFiles = (incoming: File[]) => {
    setError(null);
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => f.name + f.size));
      const merged = [...prev];
      for (const f of incoming) {
        if (!seen.has(f.name + f.size)) merged.push(f);
      }
      return merged.slice(0, 50);
    });
  };

  const run = async () => {
    if (files.length === 0 || busy) return;
    setBusy(true);
    setDone(0);
    setError(null);
    onRows([]);
    fileMap.current = new Map(files.map((f) => [f.name, f]));
    const collected: BatchRow[] = [];
    try {
      for (let i = 0; i < files.length; i += CHUNK) {
        const chunk = files.slice(i, i + CHUNK);
        const form = new FormData();
        chunk.forEach((f) => form.append("files", f));
        const res = await fetch("/api/scan/batch", { method: "POST", body: form });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "The batch request failed.");
        }
        const batchRows = (await res.json()) as BatchRow[];
        collected.push(...batchRows);
        setDone(Math.min(files.length, i + chunk.length));
        onRows([...collected]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong during the batch scan.");
    } finally {
      setBusy(false);
    }
  };

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      switch (sortKey) {
        case "score":
          return (a.score - b.score) * dir;
        case "sizeBytes":
          return (a.sizeBytes - b.sizeBytes) * dir;
        case "type":
          return a.type.localeCompare(b.type) * dir;
        default:
          return a.filename.localeCompare(b.filename) * dir;
      }
    });
    return copy;
  }, [rows, sortKey, sortAsc]);

  const header = (key: SortKey, label: string, extra = "") => (
    <th className={`px-3 py-2 text-left ${extra}`}>
      <button
        onClick={() => {
          if (sortKey === key) setSortAsc((v) => !v);
          else {
            setSortKey(key);
            setSortAsc(key === "filename" || key === "type");
          }
        }}
        className={`inline-flex items-center gap-1 text-cap font-semibold uppercase tracking-wide transition-colors duration-150 ${
          sortKey === key ? "text-ink" : "text-ink-faint hover:text-ink-dim"
        }`}
      >
        {label} <ArrowUpDown size={10} />
      </button>
    </th>
  );

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "steglab-batch-report.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <section className="space-y-4">
        <DropZone
          onFile={(f) => addFiles([f])}
          onFiles={addFiles}
          multiple
          accept="*/*"
          accent="danger"
          headline="Drop up to 50 files"
          note="They are scanned in order — nothing leaves this machine"
          icon={<FolderSearch size={16} strokeWidth={1.8} />}
        />

        {files.length > 0 && (
          <div className="rounded-card border border-line bg-card">
            <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
              <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
                Queue · {files.length} file{files.length === 1 ? "" : "s"}
              </p>
              <button
                onClick={() => setFiles([])}
                disabled={busy}
                className="text-cap text-ink-faint transition-colors duration-150 hover:text-ink disabled:opacity-40"
              >
                Clear
              </button>
            </div>
            <ul className="max-h-[220px] overflow-y-auto p-2">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-cap">
                  <span className="truncate text-ink-dim">{f.name}</span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-faint">
                    {formatBytes(f.size)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="rounded-card border border-danger-edge bg-danger-dim px-4 py-3 text-body text-ink">
            {error}
          </div>
        )}

        <button
          onClick={() => void run()}
          disabled={files.length === 0 || busy}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-b from-danger to-[#d13838] px-4 text-body font-semibold text-white transition-all duration-150 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Search size={15} />
          {busy ? `Scanning ${done}/${files.length}…` : `Scan ${files.length || ""} file${files.length === 1 ? "" : "s"}`}
        </button>

        {(busy || done > 0) && files.length > 0 && (
          <div>
            <div className="h-1.5 rounded-full bg-line">
              <motion.div
                className="h-full rounded-full bg-danger"
                animate={{ width: `${(done / files.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-ink-faint">
              {busy ? `Scanning file ${Math.min(done + 1, files.length)} of ${files.length}…` : `Finished ${done} of ${files.length}.`}
            </p>
          </div>
        )}

        {rows.length > 0 && !busy && (
          <button
            onClick={exportJson}
            className="h-9 w-full rounded-md border border-line px-3 text-cap font-medium text-ink-dim transition-colors duration-150 hover:border-line-bright hover:text-ink"
          >
            Export batch report (JSON)
          </button>
        )}
      </section>

      <section>
        {rows.length === 0 ? (
          <div className="grid min-h-[260px] place-items-center rounded-card border border-line bg-card p-8">
            <p className="max-w-sm text-center text-body text-ink-dim">
              Queue a folder&apos;s worth of files on the left. Each file gets a
              score and a verdict; click any row afterwards for the full
              single-file breakdown.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-card">
            <table className="w-full min-w-[640px] border-collapse text-body">
              <thead>
                <tr className="border-b border-line">
                  {header("filename", "File")}
                  {header("type", "Type")}
                  {header("sizeBytes", "Size")}
                  {header("score", "Score")}
                  <th className="px-3 py-2 text-left text-cap font-semibold uppercase tracking-wide text-ink-faint">
                    Verdict
                  </th>
                  <th className="px-3 py-2 text-left text-cap font-semibold uppercase tracking-wide text-ink-faint">
                    Payload hint
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => {
                  const file = fileMap.current.get(row.filename);
                  return (
                    <tr
                      key={i}
                      onClick={() => file && void onInspect(file)}
                      className={`border-b border-line/60 last:border-0 ${
                        file ? "cursor-pointer hover:bg-raise" : ""
                      } transition-colors duration-100`}
                      title={file ? "Open in single-file view" : undefined}
                    >
                      <td className="max-w-[200px] truncate px-3 py-2.5 text-ink">{row.filename}</td>
                      <td className="px-3 py-2.5 text-ink-dim">{row.type}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-ink-faint tabular">
                        {formatBytes(row.sizeBytes)}
                      </td>
                      <td className={`px-3 py-2.5 font-mono font-semibold tabular ${scoreColor(row.score)}`}>
                        {row.score < 0 ? "—" : row.score}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${labelBadgeClass(row.label)}`}>
                          {row.label}
                        </span>
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2.5 text-cap text-ink-faint">
                        {row.payloadHint || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
