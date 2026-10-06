"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LoadedFile } from "./ScannerWorkbench";

/* ------------------------------------------------------------------ */
/* shared helpers                                                      */
/* ------------------------------------------------------------------ */

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="grid min-h-[240px] place-items-center rounded-card border border-line bg-card p-8">
      <p className="max-w-sm text-center text-body text-ink-dim">{text}</p>
    </div>
  );
}

/** Decode the loaded file into RGBA pixel data (null for non-images). */
function usePixels(loaded: LoadedFile | null) {
  const [pixels, setPixels] = useState<ImageData | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPixels(null);
    if (!loaded?.isImage) return;
    void (async () => {
      try {
        const bitmap = await createImageBitmap(loaded.file);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0);
        if (!cancelled) {
          setPixels(ctx.getImageData(0, 0, bitmap.width, bitmap.height));
        }
        bitmap.close();
      } catch {
        /* unsupported image format in the browser — tabs show the hint */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded]);
  return pixels;
}

const CHANNELS = [
  { id: 0, label: "Red", color: "#f04747" },
  { id: 1, label: "Green", color: "#23d18b" },
  { id: 2, label: "Blue", color: "#4c8dff" },
] as const;

/* ------------------------------------------------------------------ */
/* LSB planes                                                          */
/* ------------------------------------------------------------------ */

export function LsbPlanesTab({ loaded }: { loaded: LoadedFile | null }) {
  const pixels = usePixels(loaded);
  const [channel, setChannel] = useState(0);
  const [bit, setBit] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pixels) return;
    const { width, height, data } = pixels;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    const out = ctx.createImageData(width, height);
    const mask = 1 << bit;
    for (let i = 0; i < width * height; i++) {
      const v = (data[i * 4 + channel] & mask) !== 0 ? 255 : 0;
      out.data[i * 4] = v;
      out.data[i * 4 + 1] = v;
      out.data[i * 4 + 2] = v;
      out.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
  }, [pixels, channel, bit]);

  if (!loaded) return <EmptyHint text="Load an image on the Single file tab first — its bit planes render here." />;
  if (!loaded.isImage || !pixels) return <EmptyHint text="Bit planes only exist for images. Load a PNG, BMP or JPEG on the Single file tab." />;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <section className="space-y-4">
        <div className="rounded-card border border-line bg-card p-4">
          <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">Channel</p>
          <div className="mt-2 flex gap-1.5">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                onClick={() => setChannel(c.id)}
                className={`h-8 flex-1 rounded-md border text-cap font-medium transition-colors duration-150 ${
                  channel === c.id
                    ? "border-line-bright bg-raise text-ink"
                    : "border-line text-ink-faint hover:text-ink-dim"
                }`}
                style={channel === c.id ? { borderColor: c.color } : undefined}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-cap font-semibold uppercase tracking-wide text-ink-faint">
            Bit plane · {bit === 0 ? "LSB" : bit === 7 ? "MSB" : `bit ${bit}`}
          </p>
          <input
            type="range"
            min={0}
            max={7}
            value={bit}
            onChange={(e) => setBit(Number(e.target.value))}
            className="mt-2 w-full accent-danger"
          />
          <div className="flex justify-between text-[10px] text-ink-faint">
            <span>0 · least significant</span>
            <span>7 · most</span>
          </div>
        </div>
        <div className="rounded-card border border-line bg-card p-4 text-body leading-5 text-ink-dim">
          <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">How to read this</p>
          <p className="mt-2">
            Higher bit planes (5–7) show the actual picture. The LSB plane of a
            clean graphic usually shows structure too — outlines, flat areas,
            banding. A plane of pure static with no visible structure is a
            classic sign of embedded encrypted data.
          </p>
        </div>
      </section>
      <section className="rounded-card border border-line bg-card p-3.5">
        <canvas
          ref={canvasRef}
          className="w-full rounded"
          style={{ imageRendering: "pixelated", maxHeight: 480, objectFit: "contain" }}
        />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Histogram                                                           */
/* ------------------------------------------------------------------ */

export function HistogramTab({ loaded }: { loaded: LoadedFile | null }) {
  const pixels = usePixels(loaded);

  const hists = useMemo(() => {
    if (!pixels) return null;
    const out = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    const { data } = pixels;
    for (let i = 0; i < data.length; i += 4) {
      out[0][data[i]]++;
      out[1][data[i + 1]]++;
      out[2][data[i + 2]]++;
    }
    return out;
  }, [pixels]);

  if (!loaded) return <EmptyHint text="Load an image on the Single file tab first — its channel histograms render here." />;
  if (!loaded.isImage || !hists) return <EmptyHint text="Histograms only exist for images. Load a PNG, BMP or JPEG on the Single file tab." />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {CHANNELS.map((c) => (
          <HistCanvas key={c.id} hist={hists[c.id]} color={c.color} label={c.label} />
        ))}
      </div>
      <div className="rounded-card border border-line bg-card p-4 text-body leading-5 text-ink-dim">
        <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">What LSB embedding does to a histogram</p>
        <p className="mt-2 max-w-3xl">
          LSB replacement moves counts only between value pairs (0,1), (2,3),
          (4,5)… At high embedding rates the two bars in each pair become
          suspiciously equal — a comb-like &quot;pairs of twins&quot; pattern. That
          equalisation is exactly what the chi-square sweep measures.
        </p>
      </div>
    </div>
  );
}

function HistCanvas({ hist, color, label }: { hist: Uint32Array; color: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const W = 512;
    const H = 160;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    let max = 1;
    for (let i = 0; i < 256; i++) if (hist[i] > max) max = hist[i];
    ctx.fillStyle = color;
    for (let i = 0; i < 256; i++) {
      // sqrt scale keeps dominant flat-colour spikes from crushing the rest
      const h = Math.round(Math.sqrt(hist[i] / max) * (H - 4));
      ctx.fillRect(i * 2, H - h, 2, h);
    }
  }, [hist, color]);
  return (
    <div className="rounded-card border border-line bg-card p-3.5">
      <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">{label} · 0–255</p>
      <canvas ref={ref} className="mt-2 w-full rounded bg-ground" style={{ height: 120 }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hex viewer                                                          */
/* ------------------------------------------------------------------ */

const PAGE = 512; // bytes per page, 16 per row

export function HexViewerTab({ loaded }: { loaded: LoadedFile | null }) {
  const [page, setPage] = useState(0);
  const [jump, setJump] = useState("");

  useEffect(() => setPage(0), [loaded]);

  if (!loaded) return <EmptyHint text="Load any file on the Single file tab first — its raw bytes render here." />;

  const bytes = new Uint8Array(loaded.bytes);
  const pages = Math.max(1, Math.ceil(bytes.length / PAGE));
  const start = page * PAGE;
  const slice = bytes.subarray(start, Math.min(bytes.length, start + PAGE));

  const rows: { offset: number; hex: string[]; ascii: string }[] = [];
  for (let r = 0; r < slice.length; r += 16) {
    const line = slice.subarray(r, r + 16);
    rows.push({
      offset: start + r,
      hex: Array.from(line, (b) => b.toString(16).padStart(2, "0")),
      ascii: Array.from(line, (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "·")).join(""),
    });
  }

  const goJump = () => {
    const v = jump.trim();
    if (!v) return;
    const off = v.startsWith("0x") ? parseInt(v, 16) : parseInt(v, 10);
    if (!Number.isNaN(off) && off >= 0 && off < bytes.length) {
      setPage(Math.floor(off / PAGE));
    }
  };

  return (
    <div className="rounded-card border border-line bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">
        <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
          {loaded.file.name} · {bytes.length.toLocaleString()} bytes
        </p>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && goJump()}
            placeholder="Jump to offset (dec or 0x…)"
            className="h-8 w-48 rounded-md border border-line bg-ground px-2.5 font-mono text-cap text-ink placeholder:text-ink-faint focus:border-line-bright focus:outline-none"
          />
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="h-8 rounded-md border border-line px-2.5 text-cap text-ink-dim transition-colors duration-150 enabled:hover:text-ink disabled:opacity-40"
          >
            ‹ Prev
          </button>
          <span className="font-mono text-cap text-ink-faint tabular">
            {page + 1}/{pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page >= pages - 1}
            className="h-8 rounded-md border border-line px-2.5 text-cap text-ink-dim transition-colors duration-150 enabled:hover:text-ink disabled:opacity-40"
          >
            Next ›
          </button>
          <button
            onClick={() => setPage(pages - 1)}
            className="h-8 rounded-md border border-line px-2.5 text-cap text-ink-dim transition-colors duration-150 hover:text-ink"
            title="Appended payloads live at the very end of a file"
          >
            End ⇥
          </button>
        </div>
      </div>
      <div className="overflow-x-auto p-4">
        <pre className="font-mono text-[11px] leading-[1.7] text-ink-dim">
          {rows.map((row) => (
            <div key={row.offset} className="flex gap-4">
              <span className="text-ink-faint">{row.offset.toString(16).padStart(8, "0")}</span>
              <span className="w-[376px]">
                {row.hex.map((h, i) => (
                  <span key={i} className={i % 2 === 0 ? "text-ink" : "text-ink-dim"}>
                    {h}
                    {i === 7 ? "  " : " "}
                  </span>
                ))}
              </span>
              <span className="text-azure/80">{row.ascii}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Entropy map                                                         */
/* ------------------------------------------------------------------ */

export function EntropyMapTab({ loaded }: { loaded: LoadedFile | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState<{ windows: number; max: number; mean: number } | null>(null);

  useEffect(() => {
    setStats(null);
    const canvas = canvasRef.current;
    if (!canvas || !loaded) return;
    const bytes = new Uint8Array(loaded.bytes);
    const WIN = 256;
    const windows = Math.max(1, Math.ceil(bytes.length / WIN));
    const cols = 64;
    const rowsN = Math.ceil(windows / cols);
    const CELL = 10;
    canvas.width = cols * CELL;
    canvas.height = rowsN * CELL;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0a0f1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let maxH = 0;
    let sumH = 0;
    const counts = new Uint32Array(256);
    for (let w = 0; w < windows; w++) {
      counts.fill(0);
      const startByte = w * WIN;
      const end = Math.min(bytes.length, startByte + WIN);
      const n = end - startByte;
      for (let i = startByte; i < end; i++) counts[bytes[i]]++;
      let h = 0;
      for (let i = 0; i < 256; i++) {
        if (counts[i] === 0) continue;
        const p = counts[i] / n;
        h -= p * Math.log2(p);
      }
      maxH = Math.max(maxH, h);
      sumH += h;
      // 0 bits → deep blue, 8 bits → hot red
      const t = h / 8;
      const r = Math.round(30 + 210 * t);
      const g = Math.round(40 + 60 * (1 - Math.abs(t - 0.5) * 2));
      const b = Math.round(200 * (1 - t) + 40);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect((w % cols) * CELL, Math.floor(w / cols) * CELL, CELL - 1, CELL - 1);
    }
    setStats({ windows, max: maxH, mean: sumH / windows });
  }, [loaded]);

  if (!loaded) return <EmptyHint text="Load any file on the Single file tab first — its entropy map renders here." />;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="rounded-card border border-line bg-card p-3.5">
        <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
          Byte entropy · 256-byte windows, reading order
        </p>
        <div className="mt-2.5 overflow-x-auto">
          <canvas ref={canvasRef} className="rounded" style={{ imageRendering: "pixelated", maxWidth: "100%" }} />
        </div>
        <div className="mt-2.5 flex items-center gap-2 text-[10px] text-ink-faint">
          <span>0 bits</span>
          <span className="h-2 w-40 rounded-full" style={{ background: "linear-gradient(90deg,#1e28c8,#8c5a78,#f0472d)" }} />
          <span>8 bits (random/encrypted)</span>
        </div>
      </section>
      <section className="space-y-4">
        {stats && (
          <div className="rounded-card border border-line bg-card p-4">
            <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">Measurements</p>
            <dl className="mt-2.5 space-y-2 text-body">
              <div className="flex justify-between"><dt className="text-ink-faint">Windows</dt><dd className="font-mono text-ink tabular">{stats.windows}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-faint">Mean entropy</dt><dd className="font-mono text-ink tabular">{stats.mean.toFixed(2)} bits</dd></div>
              <div className="flex justify-between"><dt className="text-ink-faint">Peak entropy</dt><dd className="font-mono text-ink tabular">{stats.max.toFixed(2)} bits</dd></div>
            </dl>
          </div>
        )}
        <div className="rounded-card border border-line bg-card p-4 text-body leading-5 text-ink-dim">
          <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">How to read this</p>
          <p className="mt-2">
            The map walks the file start to finish. Compressed image data reads
            hot (red) by nature — what matters is the <em>tail</em>: a solid
            hot block after the image&apos;s natural end is the fingerprint of an
            appended encrypted payload. Jump to the end in the hex viewer to
            confirm.
          </p>
        </div>
      </section>
    </div>
  );
}
