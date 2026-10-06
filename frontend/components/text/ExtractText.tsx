"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, KeyRound, ScanText, ShieldAlert, Unlock } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import DropZone from "@/components/ui/DropZone";
import PasswordField from "@/components/ui/PasswordField";
import { ApiError, postForm } from "@/lib/api";
import { countInvisible, invisibleClass, splitInvisibleRuns, type TextExtractResponse, type TextProbe } from "@/lib/text";

export default function ExtractText() {
  const [text, setText] = useState("");
  const [probe, setProbe] = useState<TextProbe | null>(null);
  const [probing, setProbing] = useState(false);
  const [password, setPassword] = useState("");
  const [revealMode, setRevealMode] = useState<"real" | "decoy">("real");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [result, setResult] = useState<TextExtractResponse | null>(null);
  const [inspect, setInspect] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced probe whenever the text changes.
  useEffect(() => {
    setResult(null);
    setProbe(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 4) return;
    debounceRef.current = setTimeout(() => {
      setProbing(true);
      postForm<TextProbe>("/api/extract/text/probe", { text })
        .then((p) => {
          setProbe(p);
          if (!p.decoyDetected) setRevealMode("real");
        })
        .catch(() => setProbe(null))
        .finally(() => setProbing(false));
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setErrorCode(null);
    setResult(null);
    try {
      const res = await postForm<TextExtractResponse>("/api/extract/text", {
        text,
        password,
        revealMode,
      });
      setResult(res);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setErrorCode(e.code);
      } else {
        setError("Something went wrong while extracting.");
      }
    } finally {
      setBusy(false);
    }
  };

  const invisible = countInvisible(text);
  const inputCls =
    "w-full rounded-md border border-line bg-ground px-3 py-2 text-body text-ink placeholder:text-ink-faint focus:border-line-bright focus:outline-none";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ================= left: input ================= */}
      <section className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
              Suspect text
            </label>
            {text.trim().length >= 4 && (
              <span className="text-cap text-ink-faint">
                {probing ? "scanning…" : probe?.stegoDetected ? "" : invisible > 0 ? `${invisible} invisible chars` : "looks clean"}
              </span>
            )}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Paste the text you want to inspect — the whole thing, not a selection…"
            className={`${inputCls} resize-none`}
          />
          <div className="mt-2">
            <DropZone
              onFile={(f) => {
                void f.text().then((t) => setText(t.slice(0, 2_000_000)));
              }}
              accept=".txt,.md,.log,text/plain"
              accent="amber"
              headline="…or drop a .txt file"
              compact
              icon={<ScanText size={14} strokeWidth={1.8} />}
            />
          </div>
        </div>

        {probe?.stegoDetected && (
          <div className="rounded-card border border-mint-edge bg-mint-dim px-4 py-3">
            <p className="text-body font-medium text-mint">StegLab stream detected</p>
            <p className="mt-0.5 text-cap text-ink-dim">
              {probe.technique === "whitespace" ? "trailing-whitespace encoding" : "zero-width encoding"}
              {" · "}{probe.invisibleChars?.toLocaleString()} invisible chars
              {probe.placementMode === "scattered" ? " · scattered placement" : ""}
              {probe.decoyDetected ? " · contains an additional decoy layer" : ""}
            </p>
            {probe.decoyDetected && (
              <div className="mt-2 flex rounded-md border border-line p-0.5">
                {(["real", "decoy"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setRevealMode(m)}
                    className={`h-7 flex-1 rounded text-cap font-medium capitalize transition-colors duration-150 ${
                      revealMode === m ? "bg-raise text-ink" : "text-ink-faint hover:text-ink-dim"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!probing && probe && !probe.stegoDetected && invisible > 5 && (
          <div className="rounded-card border border-amber-edge bg-amber-dim px-4 py-3 text-body leading-5 text-ink">
            {invisible} invisible Unicode characters are present, but they
            don&apos;t form a StegLab stream — this could be another tool&apos;s
            encoding. The Scanner can profile it as a file.
          </div>
        )}

        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="The password used when hiding"
        />

        {error && (
          <div
            className={`rounded-card border px-4 py-3 text-body ${
              errorCode === "WRONG_PASSWORD"
                ? "border-amber-edge bg-amber-dim text-ink"
                : errorCode === "NO_HIDDEN_DATA"
                  ? "border-line bg-card text-ink-dim"
                  : "border-danger-edge bg-danger-dim text-ink"
            }`}
          >
            {errorCode === "WRONG_PASSWORD"
              ? "Wrong password — or some of the invisible characters were altered. Both look identical by design."
              : error}
          </div>
        )}

        <button
          onClick={() => void submit()}
          disabled={text.trim().length === 0 || password.length === 0 || busy}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-b from-amber to-[#e08a00] px-4 text-body font-semibold text-ground transition-all duration-150 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <KeyRound size={15} />
          {busy ? "Extracting…" : "Extract message"}
        </button>
      </section>

      {/* ================= right: output ================= */}
      <section>
        {!result ? (
          <div className="grid min-h-[300px] place-items-center rounded-card border border-line bg-card p-8">
            <div className="max-w-md text-center">
              <Eye className="mx-auto text-amber" size={28} strokeWidth={1.5} />
              <h3 className="mt-3 text-section text-ink">The hidden message shows here</h3>
              <p className="mt-2 text-body text-ink-dim">
                Paste a text on the left. StegLab automatically checks for its
                invisible stream — zero-width Unicode or trailing whitespace —
                and only the password stands between you and the message.
              </p>
              {invisible > 3 && (
                <div className="mx-auto mt-4 max-w-sm rounded-card border border-line bg-ground p-3.5 text-left">
                  <button
                    onClick={() => setInspect((v) => !v)}
                    className="text-cap font-semibold uppercase tracking-wide text-ink-faint transition-colors duration-150 hover:text-ink"
                  >
                    {inspect ? "Hide" : "Show"} invisible characters
                  </button>
                  {inspect && (
                    <p className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5">
                      {splitInvisibleRuns(text.slice(0, 4000)).map((run, i) =>
                        run.invisible ? (
                          <span key={i} className={`mx-px rounded px-1 py-0.5 ${invisibleClass(run.text[0])}`}>
                            ·{run.text.length}·
                          </span>
                        ) : (
                          <span key={i} className="text-ink-dim">{run.text}</span>
                        ),
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="rounded-card border border-mint-edge bg-mint-dim px-4 py-3">
                <p className="flex items-center gap-2 text-body font-medium text-mint">
                  <Unlock size={14} /> Message recovered
                </p>
                <p className="mt-0.5 text-cap text-ink-dim">
                  {result.technique} encoding
                  {result.revealMode === "decoy" ? " · you are looking at the DECOY message" : ""}
                </p>
              </div>

              <div className="rounded-card border border-line bg-card p-4">
                <p className="text-cap font-semibold uppercase tracking-wide text-ink-faint">Plaintext</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-body leading-6 text-ink">
                  {result.message}
                </p>
                <button
                  onClick={() => void navigator.clipboard.writeText(result.message)}
                  className="mt-3 h-8 rounded-md border border-line px-3 text-cap font-medium text-ink-dim transition-colors duration-150 hover:border-line-bright hover:text-ink"
                >
                  Copy message
                </button>
              </div>

              {result.matchedKeywords.length > 0 && (
                <div className="rounded-card border border-danger-edge bg-danger-dim px-4 py-3">
                  <p className="flex items-center gap-1.5 text-body font-medium text-danger">
                    <ShieldAlert size={14} /> Suspicious content detected
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.matchedKeywords.map((k) => (
                      <span
                        key={k}
                        className="rounded-full border border-danger-edge bg-danger-dim px-2 py-0.5 font-mono text-[11px] text-danger"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.decoyPresent && result.revealMode === "real" && (
                <div className="rounded-card border border-amber-edge bg-amber-dim px-4 py-3 text-body text-ink">
                  This text also contains a decoy message. Select
                  &quot;Decoy&quot; and use its own password to view it.
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </section>
    </div>
  );
}
