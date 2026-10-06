"use client";

import { useState } from "react";
import { Check, Copy, Download, Eye, EyeOff, HelpCircle, Wand2 } from "lucide-react";
import DropZone from "@/components/ui/DropZone";
import PasswordField from "@/components/ui/PasswordField";
import Tooltip from "@/components/ui/Tooltip";
import { ApiError, postForm } from "@/lib/api";
import { formatBytes, utf8Length } from "@/lib/format";
import {
  SAMPLE_COVER,
  invisibleClass,
  splitInvisibleRuns,
  type TextHideResponse,
} from "@/lib/text";

type Technique = "zeroWidth" | "whitespace";
type Placement = "append" | "buried" | "scattered";
const MAX_MESSAGE = 100_000;

export default function HideText({ onSwitchToExtract }: { onSwitchToExtract: () => void }) {
  const [technique, setTechnique] = useState<Technique>("zeroWidth");
  const [placement, setPlacement] = useState<Placement>("append");
  const [cover, setCover] = useState("");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [decoyOn, setDecoyOn] = useState(false);
  const [decoyMessage, setDecoyMessage] = useState("");
  const [decoyPassword, setDecoyPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TextHideResponse | null>(null);
  const [revealHidden, setRevealHidden] = useState(false);
  const [copied, setCopied] = useState(false);

  const messageBytes = utf8Length(message);
  const zeroWidthNeeded = (15 + 54 + messageBytes) * 4;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setRevealHidden(false);
    try {
      const res = await postForm<TextHideResponse>("/api/hide/text", {
        cover,
        message,
        password,
        technique,
        mode: placement,
        decoyMessage: decoyOn ? decoyMessage : undefined,
        decoyPassword: decoyOn ? decoyPassword : undefined,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong while hiding.");
    } finally {
      setBusy(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const downloadResult = () => {
    if (!result) return;
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "steglab-message.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const canRun =
    cover.trim().length > 0 &&
    message.trim().length > 0 &&
    messageBytes <= MAX_MESSAGE &&
    password.length > 0 &&
    (!decoyOn || (decoyMessage.trim().length > 0 && decoyPassword.length > 0 && decoyPassword !== password));

  const inputCls =
    "w-full rounded-md border border-line bg-ground px-3 py-2 text-body text-ink placeholder:text-ink-faint focus:border-line-bright focus:outline-none";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ================= left: inputs ================= */}
      <section className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className="flex items-center gap-1 text-cap font-semibold uppercase tracking-wide text-ink-faint">
              Cover text
              <Tooltip
                what="The innocent text your message hides inside."
                when="Anything that would look normal in the channel you're sending through — a report, a chat message, a blog comment."
                tip="Longer cover makes the invisible additions less proportionally obvious, but any length works."
                accent="amber"
              >
                <HelpCircle size={11} />
              </Tooltip>
            </label>
            <button
              onClick={() => setCover(SAMPLE_COVER)}
              className="text-cap text-amber transition-colors duration-150 hover:brightness-125"
            >
              Load sample
            </button>
          </div>
          <textarea
            value={cover}
            onChange={(e) => setCover(e.target.value)}
            rows={5}
            placeholder="Paste the text everyone will see…"
            className={`${inputCls} resize-none`}
          />
          <p className="mt-1 text-right font-mono text-[11px] text-ink-faint">
            {cover.length.toLocaleString()} chars
          </p>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
              Secret message
            </label>
            <span className="font-mono text-[11px] tabular text-ink-faint">
              {formatBytes(messageBytes)}
            </span>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Type the message nobody should see…"
            className={`${inputCls} resize-none`}
          />
          {technique === "zeroWidth" && messageBytes > 0 && (
            <p className="mt-1 text-[11px] text-ink-faint">
              ≈ {zeroWidthNeeded.toLocaleString()} invisible characters will be woven into the cover.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1 text-cap font-semibold uppercase tracking-wide text-ink-faint">
            Technique
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Tooltip
              what="Each bit of your encrypted message becomes one of four zero-width Unicode characters."
              when="Chat apps, email, social media — anywhere the text can be pasted unmodified."
              tip="Survives copy-paste everywhere normal text survives, because it IS normal Unicode text."
              accent="amber"
            >
              <button
                onClick={() => setTechnique("zeroWidth")}
                className={`w-full rounded-card border p-3 text-left transition-colors duration-150 ${
                  technique === "zeroWidth" ? "border-amber-edge bg-amber-dim" : "border-line bg-card hover:border-line-bright"
                }`}
              >
                <p className="text-body font-medium text-ink">Zero-width</p>
                <p className="mt-0.5 text-cap text-ink-faint">Recommended · invisible Unicode</p>
              </button>
            </Tooltip>
            <Tooltip
              what="Each bit becomes a trailing space or tab after the cover text — the classic SNOW technique."
              when="Plain-text files exchanged as files, never through chat apps."
              tip="Many editors and chat apps silently trim trailing whitespace and destroy the message — prefer zero-width."
              accent="amber"
            >
              <button
                onClick={() => setTechnique("whitespace")}
                className={`w-full rounded-card border p-3 text-left transition-colors duration-150 ${
                  technique === "whitespace" ? "border-amber-edge bg-amber-dim" : "border-line bg-card hover:border-line-bright"
                }`}
              >
                <p className="text-body font-medium text-ink">Whitespace</p>
                <p className="mt-0.5 text-cap text-ink-faint">Legacy · spaces &amp; tabs</p>
              </button>
            </Tooltip>
          </div>
        </div>

        {technique === "zeroWidth" && (
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-cap font-semibold uppercase tracking-wide text-ink-faint">
              Placement
            </label>
            <div className="flex rounded-md border border-line p-0.5">
              {(
                [
                  ["append", "At the end", "The whole invisible block follows the visible text."],
                  ["buried", "Buried mid-text", "Inserted at a word boundary halfway through."],
                  ["scattered", "Scattered", "Drip-fed between words across the entire cover."],
                ] as [Placement, string, string][]
              ).map(([p, label, hint]) => (
                <Tooltip key={p} what={hint} when="Extraction finds the message wherever it is — placement only changes appearances." accent="amber">
                  <button
                    onClick={() => setPlacement(p)}
                    className={`h-7 flex-1 rounded text-cap font-medium transition-colors duration-150 ${
                      placement === p ? "bg-raise text-ink" : "text-ink-faint hover:text-ink-dim"
                    }`}
                  >
                    {label}
                  </button>
                </Tooltip>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-ink-faint">
              A solid invisible block at the end is the most robust against partial copy-paste.
            </p>
          </div>
        )}

        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          showMeter
          placeholder="Encryption password (always on)"
        />

        <label className="flex cursor-pointer items-center justify-between rounded-card border border-line bg-card px-3.5 py-2.5 text-cap text-ink-dim">
          <span className="flex items-center gap-1">
            Decoy message
            <Tooltip
              what="Hides a second, harmless message under its own password in the same text."
              when="Reveal the decoy layer if ever compelled; the real message stays sealed."
              tip="Passwords must differ."
              accent="amber"
            >
              <HelpCircle size={11} />
            </Tooltip>
          </span>
          <button
            onClick={() => setDecoyOn((v) => !v)}
            className={`relative h-5 w-9 rounded-full transition-colors duration-150 ${decoyOn ? "bg-amber" : "bg-line"}`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-transform duration-150 ${decoyOn ? "translate-x-4" : "translate-x-0.5"}`}
            />
          </button>
        </label>
        {decoyOn && (
          <div className="space-y-2">
            <textarea
              value={decoyMessage}
              onChange={(e) => setDecoyMessage(e.target.value)}
              rows={2}
              placeholder="The innocent cover story…"
              className={`${inputCls} resize-none`}
            />
            <PasswordField
              label="Decoy password"
              value={decoyPassword}
              onChange={setDecoyPassword}
              placeholder="Different from the real one"
            />
            {decoyPassword && decoyPassword === password && (
              <p className="text-cap text-danger">The decoy password must differ from the real one.</p>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-card border border-danger-edge bg-danger-dim px-4 py-3 text-body text-ink">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => void submit()}
            disabled={!canRun || busy}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-gradient-to-b from-amber to-[#e08a00] px-4 text-body font-semibold text-ground transition-all duration-150 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Wand2 size={15} />
            {busy ? "Weaving…" : "Hide message in text"}
          </button>
          {result && (
            <button
              onClick={onSwitchToExtract}
              className="h-10 rounded-md border border-line px-3 text-cap font-medium text-ink-dim transition-colors duration-150 hover:border-line-bright hover:text-ink"
            >
              Verify →
            </button>
          )}
        </div>
      </section>

      {/* ================= right: output ================= */}
      <section>
        {!result ? (
          <div className="grid min-h-[300px] place-items-center rounded-card border border-line bg-card p-8">
            <div className="max-w-md text-center">
              <EyeOff className="mx-auto text-amber" size={28} strokeWidth={1.5} />
              <h3 className="mt-3 text-section text-ink">The output looks like ordinary text</h3>
              <p className="mt-2 text-body text-ink-dim">
                Your cover text returns visually unchanged — but it carries the
                encrypted message as zero-width characters. Copy it into any
                chat or email; the recipient extracts it here.
              </p>
              <DropZone
                onFile={(f) => {
                  void f.text().then((t) => setCover(t.slice(0, 2_000_000)));
                }}
                accept=".txt,.md,.log,text/plain"
                accent="amber"
                headline="…or drop a .txt as cover"
                compact
                icon={<Download size={14} className="rotate-180" strokeWidth={1.8} />}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-card border border-mint-edge bg-mint-dim px-4 py-3">
              <p className="text-body font-medium text-mint">Message hidden</p>
              <p className="mt-0.5 text-cap text-ink-dim">
                {result.invisibleChars.toLocaleString()} invisible {result.technique === "whitespace" ? "whitespace" : "zero-width"} chars
                · {formatBytes(result.bytesEmbedded)} embedded
                {result.technique === "whitespace" ? " · trailing-whitespace encoding" : ` · placed ${result.placementMode}`}
                {result.decoy ? " · decoy included" : ""}
              </p>
            </div>

            <div className="rounded-card border border-line bg-card">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
                  Output · {result.text.length.toLocaleString()} chars
                </p>
                <button
                  onClick={() => setRevealHidden((v) => !v)}
                  className="flex items-center gap-1 text-cap text-ink-faint transition-colors duration-150 hover:text-ink"
                >
                  {revealHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                  {revealHidden ? "Hide invisible" : "Show invisible"}
                </button>
              </div>
              <div className="max-h-[280px] overflow-y-auto p-4">
                {revealHidden ? (
                  result.technique === "zeroWidth" ? (
                    <p className="whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-ink">
                      {splitInvisibleRuns(result.text).map((run, i) =>
                        run.invisible ? (
                          <span key={i} className={`mx-px rounded px-1 py-0.5 ${invisibleClass(run.text[0])}`} title={`${run.text.length} invisible chars`}>
                            ·{run.text.length}·
                          </span>
                        ) : (
                          <span key={i} className="text-ink-dim">{run.text}</span>
                        ),
                      )}
                    </p>
                  ) : (
                    <p className="whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-ink">
                      <span className="text-ink-dim">{result.text.replace(/[\t ]+$/, "")}</span>
                      {Array.from(result.text.match(/[\t ]+$/)?.[0] ?? "").map((c, i) => (
                        <span
                          key={i}
                          className={`rounded px-0.5 ${c === "\t" ? "bg-teal-dim text-teal" : "bg-amber-dim text-amber"}`}
                        >
                          {c === "\t" ? "⇥" : "␣"}
                        </span>
                      ))}
                    </p>
                  )
                ) : (
                  <p className="whitespace-pre-wrap break-words text-body leading-6 text-ink">
                    {result.text}
                  </p>
                )}
              </div>
              <div className="flex gap-2 border-t border-line p-3">
                <button
                  onClick={() => void copyResult()}
                  className="flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-gradient-to-b from-amber to-[#e08a00] px-4 text-body font-semibold text-ground transition-all duration-150 hover:brightness-110"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied — invisible chars intact" : "Copy stego text"}
                </button>
                <button
                  onClick={downloadResult}
                  className="h-9 rounded-md border border-line px-3 text-cap font-medium text-ink-dim transition-colors duration-150 hover:border-line-bright hover:text-ink"
                >
                  <Download size={14} className="mr-1 inline" /> .txt
                </button>
              </div>
            </div>

            <p className="text-[11px] leading-4 text-ink-faint">
              Copy from the button — not by selecting the text — so every
              invisible character travels with it. A partial copy cuts the
              invisible stream and the message is unrecoverable.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
