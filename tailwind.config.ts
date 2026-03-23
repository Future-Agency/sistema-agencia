import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0a0a0f', 2: '#12121a', 3: '#1a1a28', 4: '#22223a' },
        border: '#2a2a40',
        txt: { DEFAULT: '#e8e8f0', 2: '#a0a0b8', 3: '#6a6a80' },
        green: { DEFAULT: '#00d97e', bg: 'rgba(0,217,126,.12)' },
        yellow: { DEFAULT: '#f5a623', bg: 'rgba(245,166,35,.12)' },
        red: { DEFAULT: '#f5365c', bg: 'rgba(245,54,92,.12)' },
        blue: { DEFAULT: '#5e72e4', bg: 'rgba(94,114,228,.12)' },
        purple: { DEFAULT: '#8965e0' },
      },
    },
  },
  plugins: [],
}
export default config
