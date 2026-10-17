// Standalone web build config (browser-only, no Electron)
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  // Relative asset paths so the build runs from any folder or host (e.g. a hosted preview)
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@stores': resolve('src/renderer/src/stores'),
      '@components': resolve('src/renderer/src/components')
    }
  },
  build: {
    outDir: resolve(__dirname, 'dist/web')
  }
})
