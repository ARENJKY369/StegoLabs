import {
  LayoutDashboard,
  Image as ImageIcon,
  AudioLines,
  FileText,
  Waypoints,
  Radar,
  Sparkles,
  Lock,
  Wrench,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

export type ModuleAccent =
  | "teal"
  | "grape"
  | "amber"
  | "danger"
  | "mint"
  | "azure";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  accent: ModuleAccent;
}

/**
 * One accent per module, used consistently across the whole app:
 * hide=teal, audio=purple, text/docs=amber, scanner=red, clean=green,
 * network=blue. Dashboard and the rest borrow the teal brand accent.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, accent: "teal" },
  { label: "Image Stego", href: "/image", icon: ImageIcon, accent: "teal" },
  { label: "Audio Stego", href: "/audio", icon: AudioLines, accent: "grape" },
  { label: "Text & Docs", href: "/text", icon: FileText, accent: "amber" },
  { label: "Network Sim", href: "/network", icon: Waypoints, accent: "azure" },
  { label: "Scanner", href: "/scanner", icon: Radar, accent: "danger" },
  { label: "Clean & Verify", href: "/clean", icon: Sparkles, accent: "mint" },
  { label: "Encryption", href: "/encryption", icon: Lock, accent: "teal" },
  { label: "Utilities", href: "/utilities", icon: Wrench, accent: "azure" },
  { label: "Learn", href: "/learn", icon: GraduationCap, accent: "amber" },
];

/** Tailwind classes per accent — kept static so the compiler can see them. */
export const ACCENT = {
  teal: {
    text: "text-teal",
    bg: "bg-teal",
    dim: "bg-teal-dim",
    border: "border-teal",
    edge: "border-teal-edge",
  },
  grape: {
    text: "text-grape",
    bg: "bg-grape",
    dim: "bg-grape-dim",
    border: "border-grape",
    edge: "border-grape-edge",
  },
  amber: {
    text: "text-amber",
    bg: "bg-amber",
    dim: "bg-amber-dim",
    border: "border-amber",
    edge: "border-amber-edge",
  },
  danger: {
    text: "text-danger",
    bg: "bg-danger",
    dim: "bg-danger-dim",
    border: "border-danger",
    edge: "border-danger-edge",
  },
  mint: {
    text: "text-mint",
    bg: "bg-mint",
    dim: "bg-mint-dim",
    border: "border-mint",
    edge: "border-mint-edge",
  },
  azure: {
    text: "text-azure",
    bg: "bg-azure",
    dim: "bg-azure-dim",
    border: "border-azure",
    edge: "border-azure-edge",
  },
} as const satisfies Record<ModuleAccent, Record<string, string>>;
