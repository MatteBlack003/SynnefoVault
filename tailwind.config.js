/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'Courier New', 'monospace'],
        sans: ['"IBM Plex Mono"', 'Courier New', 'monospace'],
      },
      colors: {
        /* igloo.inc faithful palette — icy gray-blue, white text, electric blue accent */
        'bg':        '#a8b4c4',
        'bg-deep':   '#8898b0',
        'bg-light':  '#b8c4d2',
        'bg-fog':    '#c8d0dc',
        'surface':   'rgba(255,255,255,0.10)',
        'surface2':  'rgba(255,255,255,0.16)',
        'surface3':  'rgba(255,255,255,0.22)',
        'border':    'rgba(255,255,255,0.20)',
        'border2':   'rgba(255,255,255,0.35)',
        'border3':   'rgba(255,255,255,0.55)',
        'ink':       '#0f172a',
        'soft':      '#1e293b',
        'muted':     '#334155',
        'dim':       '#475569',
        'accent':    '#5b9bd5',
        'accent2':   '#82b8e8',
        'success':   '#5ecf92',
        'danger':    '#f07070',
      },
      boxShadow: {
        'accent-glow':  '0 0 28px rgba(91,155,213,0.40)',
        'viewport':     'inset 0 0 0 1.5px rgba(91,155,213,0.75), 0 0 60px rgba(91,155,213,0.06)',
        'glass':        '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.25)',
        'glass-hover':  '0 12px 40px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.30)',
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-slow': {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0.5' },
        },
      },
      animation: {
        'fade-up':    'fade-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-slow': 'pulse-slow 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
