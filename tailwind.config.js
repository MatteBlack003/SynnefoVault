/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Space Mono"', 'Courier New', 'monospace'],
        sans: ['"Space Mono"', 'Courier New', 'monospace'],
      },
      colors: {
        bg:       '#0d0f14',
        surface:  '#141720',
        surface2: '#1c2030',
        border:   '#262d3d',
        border2:  '#334155',
        ink:      '#cbd5e1',  // main text
        muted:    '#64748b',  // secondary text
        dim:      '#475569',  // dim text
        accent:   '#6366f1',  // indigo
        success:  '#22c55e',
        danger:   '#ef4444',
      },
      boxShadow: {
        'accent-glow': '0 0 24px rgba(99,102,241,0.3)',
        'danger-glow': '0 0 24px rgba(239,68,68,0.25)',
        'panel':       '0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
