/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Volt brand colours
        brand: {
          navy:   '#1A1A2E',
          yellow: '#E8B500',
          dark:   '#0F0F1A'
        }
      },
      keyframes: {
        'star-pop': {
          '0%': { transform: 'scale(0) rotate(-30deg)', opacity: '0' },
          '60%': { transform: 'scale(1.3) rotate(8deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0)', opacity: '1' }
        },
        'card-in': {
          '0%': { transform: 'translateY(12px) scale(0.97)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' }
        }
      },
      animation: {
        'star-pop': 'star-pop 0.5s cubic-bezier(.2,.9,.3,1.4) both',
        'card-in': 'card-in 0.3s ease-out both'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    }
  },
  plugins: []
}
