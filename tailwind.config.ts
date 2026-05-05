import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#ffffff',
        ink: '#0a0a0a',
        ash: '#6b6b6b',
        whisper: '#e8e8e8',
        blueprint: '#c8d4e0',
        draft: '#9ca3af',
      },
      fontFamily: {
        bodoni: ['"Bodoni Moda"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
