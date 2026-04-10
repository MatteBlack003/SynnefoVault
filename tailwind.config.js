/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Space Mono"', 'Courier New', 'monospace'],
        sans: ['"Space Mono"', 'Courier New', 'monospace'],
      },
      colors: {
        bg:       '#09090e',
        surface:  '#111318',
        surface2: '#181c24',
        surface3: '#1e2330',
        border:   '#232836',
        border2:  '#2e3548',
        border3:  '#3d4a63',
        ink:      '#e8ecf0',
        muted:    '#8892a4',
        dim:      '#4a5568',
        accent:   '#4a7fc1',
        accent2:  '#6fa3e0',
        success:  '#34d399',
        danger:   '#f87171',
      },
      boxShadow: {
        'accent-glow': '0 0 28px rgba(74,127,193,0.3)',
        'panel':       '0 4px 32px rgba(0,0,0,0.5)',
        'viewport':    'inset 0 0 80px rgba(74,127,193,0.07)',
      },
      borderRadius: {
        'pill': '9999px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
