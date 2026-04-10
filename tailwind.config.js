/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Space Mono"', 'monospace'],
        sans: ['"Space Mono"', 'monospace'], // Force monospace globally
      },
      colors: {
        background: '#f8f9fa',
        surface: 'rgba(255, 255, 255, 0.4)',
        accent: '#ffffff',
        muted: '#7a7a85',
        danger: '#ff4b4b',
        charcoal: '#1a1a1a',
        frostblue: '#eaf0f8',
      },
      boxShadow: {
        'glow-white': '0 0 40px rgba(255,255,255,0.9)',
        'glow-blue': '0 0 60px rgba(180,210,255,0.4)',
        'frost-edge': 'inset 0 0 100px rgba(100, 150, 255, 0.15)',
        'glass-panel': '0 8px 32px 0 rgba(31, 38, 135, 0.05)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
