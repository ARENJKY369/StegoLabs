/** Types & client-side file-type hints for the Clean & Verify module. */

export interface CleanItem {
  category: string;
  detail: string;
  count: number;
}

export interface CleanReport {
  fileType: string;
  profile: string;
  beforeBytes: number;
  afterBytes: number;
  itemsRemoved: CleanItem[];
  notes: string[];
  residualRisk: "LOW" | "REDUCED" | "NOT_CLEANABLE";
}

export type Cleanability =
  | { kind: "ok"; typeLabel: string }
  | { kind: "warn"; typeLabel: string; why: string }
  | { kind: "blocked"; typeLabel: string; why: string };

/** Display-only guess; the backend always re-detects by magic bytes. */
export function cleanability(file: File): Cleanability {
  const n = file.name.toLowerCase();
  if (file.type.startsWith("image/") || /\.(png|bmp|gif|jpe?g)$/.test(n)) {
    return { kind: "ok", typeLabel: "Image" };
  }
  if (file.type.startsWith("audio/") || n.endsWith(".wav")) {
    return { kind: "ok", typeLabel: "WAV audio" };
  }
  if (file.type === "application/pdf" || n.endsWith(".pdf")) {
    return { kind: "ok", typeLabel: "PDF document" };
  }
  if (file.type.includes("zip") || /\.(zip|docx|xlsx|pptx|jar|apk)$/.test(n)) {
    return {
      kind: "warn",
      typeLabel: "ZIP-based archive",
      why: "Only appended garbage after the archive end is removed — contents stay untouched.",
    };
  }
  if (file.type.startsWith("text/") || /\.(txt|md|log|csv|json|xml|html?|srt)$/.test(n)) {
    return { kind: "ok", typeLabel: "Text" };
  }
  if (/\.(exe|dll|so|elf|app)$/.test(n)) {
    return {
      kind: "blocked",
      typeLabel: "Executable",
      why: "Executables can't be cleaned byte-by-byte safely — rebuild from source instead.",
    };
  }
  return {
    kind: "warn",
    typeLabel: "Unknown type",
    why: "Will attempt a text clean; refused if the content isn't textual.",
  };
}
