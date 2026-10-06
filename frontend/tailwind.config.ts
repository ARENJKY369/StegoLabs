import type { Config } from "tailwindcss";

/**
 * StegLab design tokens.
 *
 * One accent per module, used only for: active nav, primary button,
 * active tab underline, card top border, icon. Never for body text.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces, darkest to lightest
        ground: "#0a0f1a", // page background
        panel: "#0e1524", // sidebar, large panels
        card: "#121a2b", // cards
        raise: "#151d2e", // tooltips, popovers, inputs
        line: "#1d2840", // borders
        "line-bright": "#2a3a5c", // hovered borders

        // Text
        ink: "#e7ecf5",
        "ink-dim": "#9aa7bd",
        "ink-faint": "#5e6c86",

        // Module accents — the only saturated colors in the app
        teal: { DEFAULT: "#0fd4c0", dim: "#0fd4c01f", edge: "#0fd4c04d" },
        grape: { DEFAULT: "#9d7ef0", dim: "#9d7ef01f", edge: "#9d7ef04d" },
        amber: { DEFAULT: "#f59e0b", dim: "#f59e0b1f", edge: "#f59e0b4d" },
        danger: { DEFAULT: "#f04747", dim: "#f047471f", edge: "#f047474d" },
        mint: { DEFAULT: "#23d18b", dim: "#23d18b1f", edge: "#23d18b4d" },
        azure: { DEFAULT: "#3b82f6", dim: "#3b82f61f", edge: "#3b82f64d" },
      },
      fontFamily: {
        sans: ["'Inter Variable'", "Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono Variable'", "'JetBrains Mono'", "monospace"],
      },
      // The five-step hierarchy. Adjacent elements never share a size.
      fontSize: {
        title: ["28px", { lineHeight: "34px", fontWeight: "650" }],
        section: ["18px", { lineHeight: "26px", fontWeight: "600" }],
        card: ["14px", { lineHeight: "20px", fontWeight: "600" }],
        body: ["13px", { lineHeight: "20px" }],
        cap: ["11px", { lineHeight: "16px" }],
      },
      boxShadow: {
        pop: "0 8px 24px rgba(3, 7, 15, 0.55)",
        glow: "0 0 32px var(--glow-color, rgba(15, 212, 192, 0.18))",
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
