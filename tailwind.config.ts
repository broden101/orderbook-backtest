import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: "#14b8a6", hover: "#2dd4bf" },
        buy: { DEFAULT: "#22c55e", dim: "#22c55e20" },
        sell: { DEFAULT: "#ef4444", dim: "#ef444420" },
      },
    },
  },
  plugins: [],
};
export default config;
