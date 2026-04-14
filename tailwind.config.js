/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#0f172a",
        surface: "#111827",
        card: "#1f2937",
        primary: "#f97316",
        secondary: "#22c55e",
        text: "#f8fafc",
        muted: "#94a3b8",
        border: "#334155",
      },
    },
  },
  plugins: [],
};
