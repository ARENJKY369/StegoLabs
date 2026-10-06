"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NAV_ITEMS, ACCENT } from "@/lib/nav";

/** Hamburger drawer for <lg viewports. The 240px sidebar hides itself there. */
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <button
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
        className="grid h-9 w-9 place-items-center rounded-md border border-line bg-card text-ink-dim transition-colors duration-150 hover:text-ink"
      >
        <Menu size={17} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.nav
              className="fixed inset-y-0 left-0 z-50 w-[270px] overflow-y-auto border-r border-line bg-panel p-4"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "tween", duration: 0.18 }}
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-[7px] bg-teal font-mono text-[15px] font-bold text-ground">
                    S
                  </div>
                  <span className="text-[15px] font-semibold">StegLab</span>
                </div>
                <button
                  aria-label="Close navigation"
                  onClick={() => setOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-md text-ink-dim hover:text-ink"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-0.5">
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
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-body ${
                        active
                          ? `${a.dim} text-ink`
                          : "text-ink-dim hover:bg-card"
                      }`}
                    >
                      <item.icon
                        size={16}
                        className={active ? a.text : "text-ink-faint"}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
