import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: '.',
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'es2022',
    rollupOptions: {
      input: {
        main: 'index.html',
        designer: 'designer.html',
      },
    },
  },
  server: {
    port: 5173,
  },
})
