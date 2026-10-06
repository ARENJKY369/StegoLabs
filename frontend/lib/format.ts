/** Human-friendly byte counts: 0 B, 4.2 KB, 1.8 MB. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** UTF-8 byte length of a string (what actually gets embedded). */
export function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** hh:mm:ss.mmm for log lines. */
export function timestamp(): string {
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}
