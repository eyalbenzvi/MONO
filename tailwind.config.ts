import type { Config } from "tailwindcss";

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
  plugins: [],
};

export default config;
