import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5176,
    strictPort: true,
    proxy: {
      '/ai': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/answer': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/speech-to-text': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/text-to-speech': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/topics': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
