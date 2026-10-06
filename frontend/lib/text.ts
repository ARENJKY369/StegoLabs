/** Types and rendering helpers for the Text & Docs workbench. */

export interface TextHideResponse {
  text: string;
  technique: "zeroWidth" | "whitespace";
  placementMode: string;
  invisibleChars: number;
  coverChars: number;
  messageBytes: number;
  bytesEmbedded: number;
  decoy: boolean;
}

export interface TextExtractResponse {
  message: string;
  technique: string;
  placementMode: string;
  revealMode: string;
  decoyPresent: boolean;
  contentVerdict: string;
  matchedKeywords: string[];
  entropy: number;
}

export interface TextProbe {
  stegoDetected: boolean;
  technique?: "zeroWidth" | "whitespace";
  placementMode?: string;
  decoyDetected?: boolean;
  invisibleChars?: number;
}

// U+200B ZWSP, U+200C ZWNJ, U+2060 WORD JOINER, U+200D ZWJ — the hide alphabet.
const ZWSP = "​", ZWNJ = "‌", WJOIN = "⁠", ZWJ = "‍";

const ZERO_WIDTH = /[​‌⁠‍]/g;

export function countInvisible(text: string): number {
  const m = text.match(ZERO_WIDTH);
  return m ? m.length : 0;
}

export const INVISIBLE_STYLE: ReadonlyArray<{ ch: string; label: string; className: string }> = [
  { ch: ZWSP, label: "ZWSP", className: "bg-amber-dim text-amber" },
  { ch: ZWNJ, label: "ZWNJ", className: "bg-teal-dim text-teal" },
  { ch: WJOIN, label: "WDJN", className: "bg-grape-dim text-grape" },
  { ch: ZWJ, label: "ZWJ", className: "bg-azure-dim text-azure" },
];

export function invisibleClass(ch: string): string {
  const hit = INVISIBLE_STYLE.find((s) => s.ch === ch);
  return hit ? hit.className : "bg-danger-dim text-danger";
}

/** Split text into visible and invisible runs for the highlighted reveal view. */
export function splitInvisibleRuns(text: string): { text: string; invisible: boolean }[] {
  const runs: { text: string; invisible: boolean }[] = [];
  let buf = "";
  let invisible = false;
  for (const c of text) {
    const inv = c === ZWSP || c === ZWNJ || c === WJOIN || c === ZWJ;
    if (inv !== invisible && buf) {
      runs.push({ text: buf, invisible });
      buf = "";
    }
    invisible = inv;
    buf += c;
  }
  if (buf) runs.push({ text: buf, invisible });
  return runs;
}

export const SAMPLE_COVER =
  "The quarterly report shows steady growth across all regions. " +
  "Marketing expanded into three new cities while engineering shipped the " +
  "platform rewrite ahead of schedule. Customer satisfaction climbed to " +
  "record levels, and the board approved next year's budget without changes. " +
  "Team leads should schedule reviews before the end of the month and " +
  "circulate minutes to all stakeholders.";
