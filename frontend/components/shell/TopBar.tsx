"use client";

import { Lock, Search } from "lucide-react";
import { useEffect, useState } from "react";
import MobileNav from "./MobileNav";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

/**
 * Page header: title + subtitle on the left, cosmetic search,
 * the permanent privacy badge and the session avatar on the right.
 */
export default function TopBar({ title, subtitle }: TopBarProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShortcutsOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ground/90 backdrop-blur">
      <div className="flex items-center gap-4 px-5 py-3.5 lg:px-8">
        <MobileNav />

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-semibold leading-7 tracking-tight lg:text-title">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 hidden text-body text-ink-faint sm:block">
              {subtitle}
            </p>
          ) : null}
        </div>

        {/* Cosmetic search — opens the shortcut overlay */}
        <button
          onClick={() => setShortcutsOpen(true)}
          className="hidden h-9 items-center gap-2 rounded-md border border-line bg-card px-3 text-body text-ink-faint transition-colors duration-150 hover:border-line-bright hover:text-ink-dim md:flex"
        >
          <Search size={14} />
          <span>Search tools…</span>
          <kbd className="ml-4 rounded border border-line bg-raise px-1.5 font-mono text-[10px] text-ink-faint">
            ⌘K
          </kbd>
        </button>

        {/* Permanent privacy badge — rule 10 */}
        <span
          className="flex items-center gap-1.5 rounded-full border border-mint-edge bg-mint-dim px-3 py-1.5 text-cap font-medium text-mint"
          title="All processing happens locally. No telemetry, no uploads to third parties."
        >
          <Lock size={11} strokeWidth={2.2} />
          <span className="hidden sm:inline">Nothing leaves your device</span>
          <span className="sm:hidden">Local</span>
        </span>

        <div
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-card text-cap font-semibold text-ink-dim"
          title="Anonymous session — StegLab has no accounts"
        >
          AN
        </div>
      </div>

      {shortcutsOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-card border border-line bg-raise p-5 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-card text-ink">Keyboard shortcuts</h2>
            <p className="mt-1 text-cap text-ink-faint">
              Search indexes nothing — StegLab keeps no history to search.
            </p>
            <ul className="mt-4 space-y-2.5 text-body text-ink-dim">
              {[
                ["⌘K", "Open this overlay"],
                ["Esc", "Close dialogs and overlays"],
                ["Tab", "Move between fields — every control is reachable"],
              ].map(([key, what]) => (
                <li key={key} className="flex items-center justify-between">
                  <span>{what}</span>
                  <kbd className="rounded border border-line bg-card px-2 py-0.5 font-mono text-cap text-ink-dim">
                    {key}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </header>
  );
}
