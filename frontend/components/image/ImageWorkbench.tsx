"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Tooltip from "@/components/ui/Tooltip";
import HideLsb from "./HideLsb";
import ExtractPanel from "./ExtractPanel";

type Mode = "hide" | "extract";
type Technique =
  | "lsb"
  | "dct"
  | "palette"
  | "metadata"
  | "watermark"
  | "visual";

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
    what: "Hides your message by changing the last bit of each pixel's colour value — a change invisible to the human eye.",
    when: "Hiding a text message in a photo you'll share on WhatsApp or email.",
    tip: "Always save as PNG, never JPEG — JPEG compression will destroy your hidden message completely.",
  },
  {
    id: "dct",
    label: "DCT Embed",
    ready: false,
    what: "Hides data inside the frequency coefficients a JPEG is built from, instead of raw pixels.",
    when: "When the file must survive JPEG re-compression, like a photo upload pipeline.",
    tip: "Much lower capacity than LSB — expect room for short messages only.",
  },
  {
    id: "palette",
    label: "Palette",
    ready: false,
    what: "Reorders the colour table of indexed images (GIF, 8-bit PNG) to encode bits without touching any pixel.",
    when: "Hiding small amounts of data in logos, icons or screenshots with few colours.",
    tip: "Opening and re-saving the image in most editors rewrites the palette and erases the message.",
  },
  {
    id: "metadata",
    label: "Metadata",
    ready: false,
    what: "Stores data in EXIF or text chunks that live alongside the image, not inside the pixels.",
    when: "Quick labelling or watermarking where invisibility to statistics does not matter.",
    tip: "This is the first place any analyst looks — treat it as a label, not a hiding place.",
  },
  {
    id: "watermark",
    label: "Watermark",
    ready: false,
    what: "Spreads a faint, redundant pattern across the whole image so ownership survives cropping and resizing.",
    when: "Proving a photo is yours after someone re-posts it.",
    tip: "Watermarks trade capacity for robustness — they carry an ID, not a conversation.",
  },
  {
    id: "visual",
    label: "Visual Crypto",
    ready: false,
    what: "Splits a secret image into noise-like shares that reveal the secret only when stacked together.",
    when: "Sharing a secret between two people so neither can read it alone.",
    tip: "Each share is useless by itself — losing one share loses the secret forever.",
  },
];

/** Top-level Hide/Extract switch plus the technique sub-tabs. */
export default function ImageWorkbench() {
  const [mode, setMode] = useState<Mode>("hide");
  const [technique, setTechnique] = useState<Technique>("lsb");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Hide / Extract switch */}
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
                  layoutId="image-mode-pill"
                  className="absolute inset-0 rounded-md bg-raise"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative">{m}</span>
            </button>
          ))}
        </div>

        {/* Technique tabs (hide mode only) */}
        {mode === "hide" && (
          <nav className="flex max-w-full gap-1 overflow-x-auto">
            {TECHNIQUES.map((t) => (
              <Tooltip
                key={t.id}
                what={t.what}
                when={t.when}
                tip={t.tip}
                accent="teal"
                side="bottom"
              >
                <button
                  onClick={() => setTechnique(t.id)}
                  className={`relative whitespace-nowrap px-3 py-2 text-body transition-colors duration-150 ${
                    technique === t.id
                      ? "text-ink"
                      : "text-ink-faint hover:text-ink-dim"
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
                      layoutId="image-technique-underline"
                      className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-teal"
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
          <ExtractPanel />
        ) : technique === "lsb" ? (
          <HideLsb onSwitchToExtract={() => setMode("extract")} />
        ) : (
          <ComingSoon technique={TECHNIQUES.find((t) => t.id === technique)!} />
        )}
      </div>
    </div>
  );
}

function ComingSoon({ technique }: { technique: (typeof TECHNIQUES)[number] }) {
  return (
    <div className="grid min-h-[320px] place-items-center rounded-card border border-line bg-card p-8">
      <div className="max-w-sm text-center">
        <p className="font-mono text-cap uppercase tracking-widest text-ink-faint">
          Coming soon
        </p>
        <h3 className="mt-2 text-section text-ink">{technique.label}</h3>
        <p className="mt-2 text-body text-ink-dim">{technique.what}</p>
        <p className="mt-3 text-cap text-ink-faint">
          LSB Embed is fully working today — it covers most real-world needs.
        </p>
      </div>
    </div>
  );
}
