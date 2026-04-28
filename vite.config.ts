import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    electron({
      preload: {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
      },
      renderer: {},
    }),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
