/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0d1117",
        foreground: "#f0f6fc",
        muted: "#8b949e",
        surface: "rgba(22, 27, 34, 0.7)",
        accent: "#58a6ff"
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Monument Extended', 'system-ui', 'sans-serif'],
        ui: ['Outfit', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
}
