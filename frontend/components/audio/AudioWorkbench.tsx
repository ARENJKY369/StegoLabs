"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Tooltip from "@/components/ui/Tooltip";
import HideAudio from "./HideAudio";
import ExtractAudio from "./ExtractAudio";

type Mode = "hide" | "extract";
type Technique = "lsb" | "phase" | "echo" | "spread";

const TECHNIQUES: {
  id: Technique;
  label: string;
  ready: boolean;
  what: string;
  when: string;
  tip: string;
}[] = [
  {
    id: "lsb",
    label: "LSB Embed",
    ready: true,
    what: "Hides your message in the least significant bits of each audio sample — a whisper far below the noise floor.",
    when: "Hiding a message in an uncompressed WAV recording you'll pass along intact.",
    tip: "Re-encoding to MP3 or AAC will erase the message completely — always deliver the WAV itself.",
  },
  {
    id: "phase",
    label: "Phase Coding",
    ready: false,
    what: "Encodes bits as subtle shifts in the phase of selected frequency bands, which the ear is poor at detecting.",
    when: "When the audio might face mild re-processing that LSBs would not survive.",
    tip: "Lower capacity than LSB, but survives more abuse.",
  },
  {
    id: "echo",
    label: "Echo Hiding",
    ready: false,
    what: "Adds an echo so faint and quick that it reads as room tone, varying its delay to encode bits.",
    when: "Robust hiding in music or speech that will be played through speakers and re-recorded.",
    tip: "Works best on speech with natural pauses; dense music gives fewer anchor points.",
  },
  {
    id: "spread",
    label: "Spread Spectrum",
    ready: false,
    what: "Spreads the message as wideband noise across the whole spectrum, like a radio signal under the static.",
    when: "Maximum robustness against filtering and re-compression of short clips.",
    tip: "The message survives almost everything but capacity drops to a few dozen characters.",
  },
];

export default function AudioWorkbench() {
  const [mode, setMode] = useState<Mode>("hide");
  const [technique, setTechnique] = useState<Technique>("lsb");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-line bg-card p-0.5">
          {(["hide", "extract"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`relative rounded-md px-4 py-1.5 text-body font-medium capitalize transition-colors duration-150 ${
                mode === m ? "text-ink" : "text-ink-faint hover:text-ink-dim"
              }`}
            >
              {mode === m && (
                <motion.span
                  layoutId="audio-mode-pill"
                  className="absolute inset-0 rounded-md bg-raise"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative">{m}</span>
            </button>
          ))}
        </div>

        {mode === "hide" && (
          <nav className="flex max-w-full gap-1 overflow-x-auto">
            {TECHNIQUES.map((t) => (
              <Tooltip key={t.id} what={t.what} when={t.when} tip={t.tip} accent="grape" side="bottom">
                <button
                  onClick={() => setTechnique(t.id)}
                  className={`relative whitespace-nowrap px-3 py-2 text-body transition-colors duration-150 ${
                    technique === t.id ? "text-ink" : "text-ink-faint hover:text-ink-dim"
                  }`}
                >
                  {t.label}
                  {!t.ready && (
                    <span className="ml-1.5 align-top font-mono text-[9px] uppercase text-ink-faint">
                      soon
                    </span>
                  )}
                  {technique === t.id && (
                    <motion.span
                      layoutId="audio-technique-underline"
                      className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-grape"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
                    />
                  )}
                </button>
              </Tooltip>
            ))}
          </nav>
        )}
      </div>

      <div className="mt-4">
        {mode === "extract" ? (
          <ExtractAudio />
        ) : technique === "lsb" ? (
          <HideAudio onSwitchToExtract={() => setMode("extract")} />
        ) : (
          <div className="grid min-h-[320px] place-items-center rounded-card border border-line bg-card p-8">
            <div className="max-w-sm text-center">
              <p className="font-mono text-cap uppercase tracking-widest text-ink-faint">Coming soon</p>
              <h3 className="mt-2 text-section text-ink">
                {TECHNIQUES.find((t) => t.id === technique)!.label}
              </h3>
              <p className="mt-2 text-body text-ink-dim">
                {TECHNIQUES.find((t) => t.id === technique)!.what}
              </p>
              <p className="mt-3 text-cap text-ink-faint">
                LSB Embed is fully working today — it covers most real-world needs.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
