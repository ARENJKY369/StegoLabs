"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import HideText from "./HideText";
import ExtractText from "./ExtractText";

type Mode = "hide" | "extract";

export default function TextWorkbench() {
  const [mode, setMode] = useState<Mode>("hide");

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
                  layoutId="text-mode-pill"
                  className="absolute inset-0 rounded-md bg-raise"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative">{m}</span>
            </button>
          ))}
        </div>
        <p className="text-cap text-ink-faint">
          Works on any text you can copy — chats, emails, social posts
        </p>
      </div>

      <div className="mt-4">
        {mode === "extract" ? (
          <ExtractText />
        ) : (
          <HideText onSwitchToExtract={() => setMode("extract")} />
        )}
      </div>
    </div>
  );
}
