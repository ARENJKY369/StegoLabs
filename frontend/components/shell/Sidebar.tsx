"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Settings } from "lucide-react";
import { NAV_ITEMS, ACCENT } from "@/lib/nav";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-[240px] shrink-0 flex-col border-r border-line bg-panel">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-6">
        <div className="grid h-8 w-8 place-items-center rounded-[7px] bg-teal font-mono text-[15px] font-bold text-ground">
          S
        </div>
        <div className="leading-none">
          <span className="text-[15px] font-semibold tracking-tight">
            StegLab
          </span>
          <span className="ml-1.5 align-top font-mono text-cap text-ink-faint">
            v2.0
          </span>
        </div>
      </div>

      {/* Primary navigation */}
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const a = ACCENT[item.accent];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-md px-3 py-[7px] text-body transition-colors duration-150 ${
                active
                  ? `${a.dim} text-ink`
                  : "text-ink-dim hover:bg-card hover:text-ink"
              }`}
            >
              {active && (
                <span
                  className={`absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r ${a.bg}`}
                />
              )}
              <item.icon
                size={16}
                strokeWidth={1.8}
                className={active ? a.text : "text-ink-faint group-hover:text-ink-dim"}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Secondary links */}
      <div className="mt-4 space-y-0.5 border-t border-line px-3 pt-3">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-md px-3 py-[7px] text-body text-ink-dim transition-colors duration-150 hover:bg-card hover:text-ink"
        >
          <Settings size={16} strokeWidth={1.8} className="text-ink-faint" />
          Settings
        </Link>
        <Link
          href="/docs"
          className="flex items-center gap-3 rounded-md px-3 py-[7px] text-body text-ink-dim transition-colors duration-150 hover:bg-card hover:text-ink"
        >
          <BookOpen size={16} strokeWidth={1.8} className="text-ink-faint" />
          Documentation
        </Link>
      </div>

      {/* Ephemeral session indicator */}
      <div className="m-3 mt-4 rounded-card border border-line bg-card px-3.5 py-3">
        <p className="text-cap font-medium text-ink-dim">Session storage</p>
        <p className="mt-0.5 text-cap text-ink-faint">
          Ephemeral — no data retained
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
          <div className="h-full w-0 bg-mint" aria-hidden />
        </div>
        <p className="mt-1.5 font-mono text-[10px] leading-3 text-ink-faint">
          0% · wiped on close
        </p>
      </div>
    </aside>
  );
}
