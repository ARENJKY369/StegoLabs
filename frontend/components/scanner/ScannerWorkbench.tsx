"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { BatchRow, ScanReport } from "@/lib/scanner";
import SingleScan from "./SingleScan";
import BatchScan from "./BatchScan";
import { EntropyMapTab, HexViewerTab, HistogramTab, LsbPlanesTab } from "./AuxTabs";

const TABS = [
  { id: "single", label: "Single file" },
  { id: "batch", label: "Batch folder" },
  { id: "planes", label: "LSB planes" },
  { id: "histogram", label: "Histogram" },
  { id: "hex", label: "Hex viewer" },
  { id: "entropy", label: "Entropy map" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export interface LoadedFile {
  file: File;
  url: string;
  bytes: ArrayBuffer;
  isImage: boolean;
}

/**
 * Scanner module shell. The loaded file and latest report are shared
 * across sub-tabs so the analyst can pivot between score, bit planes,
 * histogram, hex and entropy views of the same file.
 */
export default function ScannerWorkbench() {
  const [tab, setTab] = useState<TabId>("single");
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [batch, setBatch] = useState<BatchRow[]>([]);

  const loadFile = async (file: File) => {
    const bytes = await file.arrayBuffer();
    const isImage = /\.(png|bmp|jpe?g|gif)$/i.test(file.name) || file.type.startsWith("image/");
    setLoaded((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { file, url: URL.createObjectURL(file), bytes, isImage };
    });
    setReport(null);
  };

  return (
    <div>
      <nav className="flex max-w-full gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative whitespace-nowrap px-3.5 py-2.5 text-body transition-colors duration-150 ${
              tab === t.id ? "text-ink" : "text-ink-faint hover:text-ink-dim"
            }`}
          >
            {t.label}
            {tab === t.id && (
              <motion.span
                layoutId="scanner-tab-underline"
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-danger"
                transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
              />
            )}
          </button>
        ))}
      </nav>

      <div className="mt-4">
        {tab === "single" && (
          <SingleScan
            loaded={loaded}
            onLoadFile={loadFile}
            report={report}
            onReport={setReport}
            batch={batch}
            onReset={() => {
              setLoaded(null);
              setReport(null);
            }}
          />
        )}
        {tab === "batch" && (
          <BatchScan
            rows={batch}
            onRows={setBatch}
            onInspect={async (file) => {
              await loadFile(file);
              setTab("single");
            }}
          />
        )}
        {tab === "planes" && <LsbPlanesTab loaded={loaded} />}
        {tab === "histogram" && <HistogramTab loaded={loaded} />}
        {tab === "hex" && <HexViewerTab loaded={loaded} />}
        {tab === "entropy" && <EntropyMapTab loaded={loaded} />}
      </div>

      {/* Permanent honesty notice — rule: never hide the limitations. */}
      <aside className="mt-6 rounded-card border border-line bg-card px-4 py-3.5">
        <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
          Known limitations — measured, not guessed
        </p>
        <p className="mt-1.5 max-w-3xl text-body leading-5 text-ink-dim">
          Statistical tests may flag high-ISO photographs as suspicious even
          without hidden data (measured 21.9% false positive rate on noisy
          images). Structural checks are deterministic and reliable.
          Statistical checks are probabilistic.
        </p>
      </aside>
    </div>
  );
}
