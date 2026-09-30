import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"] },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      // One corner radius for every control (buttons, sizes, fields); images have none, sheet tops 16px.
      borderRadius: { control: "2px", sheet: "16px" },
      // The one layer order: header < backdrop < sheet < toast (tab bar and sticky bars sit with the header).
      zIndex: { header: "30", backdrop: "40", sheet: "50", toast: "60" },
      transitionTimingFunction: { brand: "cubic-bezier(0.2, 0, 0, 1)" },
      colors: {
        /** The one muted text colour (neutral-400: 7.9:1 on the background). */
        muted: "#a3a3a3",
        ink: {
          950: "#0a0a0a",
          900: "#0b0b0b",
          850: "#111111",
          800: "#171717",
          700: "#232323",
          600: "#333333",
        },
      },
    },
  },
  plugins: [
    // `sideways:` — phones held sideways. The Discover card needs the
    // height, so the controls move to the side (see app/page.tsx). (Not
    // Tailwind's own `landscape:`, which is orientation only.)
    plugin(({ addVariant }) => addVariant("sideways", "@media (orientation: landscape) and (max-height: 500px)")),
  ],
};

export default config;
