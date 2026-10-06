"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";
import { useState, type ReactNode } from "react";
import type { ModuleAccent } from "@/lib/nav";

const ACCENT_BORDER: Record<ModuleAccent, string> = {
  teal: "border-teal-edge",
  grape: "border-grape-edge",
  amber: "border-amber-edge",
  danger: "border-danger-edge",
  mint: "border-mint-edge",
  azure: "border-azure-edge",
};

interface TipProps {
  /** One plain-English sentence, no jargon. */
  what: string;
  /** One real-world example a non-technical person recognises. */
  when?: string;
  /** One practical warning or piece of advice. */
  tip?: string;
  accent?: ModuleAccent;
  /** The interactive element the tooltip describes. */
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}

/**
 * The StegLab tooltip. Radix primitive underneath, so it is keyboard
 * focusable, screen-reader announced (role=tooltip) and flips at screen
 * edges automatically. Desktop: 400 ms hover delay. Touch: tap to open,
 * tap elsewhere to dismiss (handled via controlled open state, since
 * hover never fires on touch screens).
 */
export default function Tooltip({
  what,
  when,
  tip,
  accent = "teal",
  children,
  side = "top",
}: TipProps) {
  const [open, setOpen] = useState<boolean | undefined>(undefined);

  return (
    <RadixTooltip.Provider delayDuration={400} skipDelayDuration={200}>
      <RadixTooltip.Root open={open} onOpenChange={setOpen}>
        <RadixTooltip.Trigger
          asChild
          onClick={(e) => {
            // Touch fallback: a tap toggles the tooltip instead of hovering.
            if (window.matchMedia("(hover: none)").matches) {
              e.preventDefault();
              setOpen((v) => !v);
            }
          }}
        >
          {children}
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            collisionPadding={12}
            sideOffset={7}
            onPointerDownOutside={() => setOpen(false)}
            className={`tt-pop z-[60] w-[260px] rounded-lg border bg-raise p-3 shadow-pop ${ACCENT_BORDER[accent]}`}
          >
            <dl className="space-y-2">
              <div>
                <dt className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
                  What
                </dt>
                <dd className="mt-0.5 text-[12px] leading-[17px] text-ink">
                  {what}
                </dd>
              </div>
              {when ? (
                <div>
                  <dt className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
                    When to use
                  </dt>
                  <dd className="mt-0.5 text-[12px] leading-[17px] text-ink-dim">
                    {when}
                  </dd>
                </div>
              ) : null}
              {tip ? (
                <div>
                  <dt className="text-cap font-semibold uppercase tracking-wide text-ink-faint">
                    Tip
                  </dt>
                  <dd className="mt-0.5 text-[12px] leading-[17px] text-ink-dim">
                    {tip}
                  </dd>
                </div>
              ) : null}
            </dl>
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
