/** Types mirroring the backend scan DTOs. */

export interface ScanFinding {
  id: string;
  name: string;
  points: number;
  detail: string;
  technical: string;
  deterministic: boolean;
}

export interface Classification {
  mode: string;
  structuralType: string;
  entropy: number;
  confidence: number;
  offset: number;
  contentVerdict: string | null;
  matchedKeywords: string[];
  encodingDetected: string | null;
}

export interface ScanReport {
  filename: string;
  detectedType: string;
  sizeBytes: number;
  score: number;
  label: string;
  findings: ScanFinding[];
  testsRun: string[];
  payloadClassification: Classification | null;
  authenticatedClassification: Classification | null;
  extractedPreview: string | null;
  heatmapData: number[][] | null;
  heatmapBlockSize: number;
  lsbPlaneR: number[][] | null;
  lsbPlaneG: number[][] | null;
  lsbPlaneB: number[][] | null;
  lsbEntropyR: number;
  lsbEntropyG: number;
  lsbEntropyB: number;
  imageWidth: number;
  imageHeight: number;
  scanDurationMs: number;
}

export interface BatchRow {
  filename: string;
  type: string;
  sizeBytes: number;
  score: number;
  label: string;
  payloadHint: string;
  findingCount: number;
  scanDurationMs: number;
}

export const TESTS: {
  id: string;
  name: string;
  points: string;
  deterministic: boolean;
  what: string;
  when: string;
  tip: string;
}[] = [
  {
    id: "signature",
    name: "File signature check",
    points: "+25",
    deterministic: true,
    what: "Compares the file's real content (magic bytes) against what its name claims it is.",
    when: "Catching a ZIP renamed to report.pdf before it slips through a mail filter.",
    tip: "A mismatch is a fact, not a statistic — someone renamed that file on purpose.",
  },
  {
    id: "trailing",
    name: "Trailing byte scan",
    points: "+30",
    deterministic: true,
    what: "Checks for data hidden after the official end of the file. PNG and JPEG have defined end markers — anything after is immediately suspicious.",
    when: "Always. This is the most common hiding technique and the most reliably detected.",
    tip: "This check is 100% deterministic. If it fires, extra data is definitely present.",
  },
  {
    id: "trailingEntropy",
    name: "Trailing entropy",
    points: "+10",
    deterministic: true,
    what: "Measures how random the appended bytes look. Encryption and compression both push entropy near the 8.0 maximum.",
    when: "Deciding whether appended data is a readable note or an encrypted payload.",
    tip: "High entropy means you will not read it without the key — focus on where it came from.",
  },
  {
    id: "embeddedSignatures",
    name: "Embedded file signatures",
    points: "+25",
    deterministic: true,
    what: "Searches appended data for complete file headers: ZIP, EXE, PDF, ELF.",
    when: "Finding a whole archive or executable glued to the back of an innocent image.",
    tip: "Combined with the trailing scan, this tells you what was smuggled, not just that something was.",
  },
  {
    id: "chiSquare",
    name: "Chi-square sweep",
    points: "+25",
    deterministic: false,
    what: "A statistical test that detects when pixel values have been made unnaturally equal — a sign of LSB embedding.",
    when: "For detecting sequential LSB embedding in images.",
    tip: "Works well at high embedding rates. Less reliable at low rates or with scattered mode — this is a known and documented limitation.",
  },
  {
    id: "lsbBalance",
    name: "LSB balance per block",
    points: "+18",
    deterministic: false,
    what: "Splits the image into 20×20 blocks and checks whether the lowest bits are suspiciously 50/50 everywhere.",
    when: "Spotting embedding that is spread across the whole image.",
    tip: "Very noisy photos (high ISO) can trip this naturally — read it together with the other signals.",
  },
  {
    id: "metadata",
    name: "Metadata anomaly",
    points: "+15",
    deterministic: true,
    what: "Walks the file's own structure looking for metadata fields that are huge or contain binary where text belongs.",
    when: "Catching payloads stuffed into PNG text chunks or JPEG comments.",
    tip: "Legitimate photo EXIF is allowed for — only clearly oversized fields fire this.",
  },
  {
    id: "invisibleUnicode",
    name: "Invisible Unicode",
    points: "+40",
    deterministic: true,
    what: "Counts zero-width characters (U+200B…U+FEFF) hiding between visible letters in text.",
    when: "Checking text copied from an email or document before forwarding it.",
    tip: "More than a handful of zero-width characters is never an accident.",
  },
  {
    id: "lsbEntropy",
    name: "LSB plane entropy",
    points: "+12",
    deterministic: false,
    what: "Measures the randomness of each colour channel's lowest bit plane. Encrypted payloads push it to the 1.0 maximum.",
    when: "A quick probabilistic cross-check on any image scan.",
    tip: "Natural images usually sit between 0.6 and 0.85 — but noisy sensors can reach higher legitimately.",
  },
];

export function scoreColor(score: number): string {
  if (score < 0) return "text-ink-faint";
  if (score <= 24) return "text-mint";
  if (score <= 59) return "text-amber";
  return "text-danger";
}

export function labelBadgeClass(label: string): string {
  switch (label) {
    case "CLEAN":
      return "border-mint-edge bg-mint-dim text-mint";
    case "SUSPICIOUS":
      return "border-amber-edge bg-amber-dim text-amber";
    case "ERROR":
      return "border-line bg-raise text-ink-faint";
    default:
      return "border-danger-edge bg-danger-dim text-danger";
  }
}
