import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#050505",
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
