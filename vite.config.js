import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // En local, /api lo sirve server.js (node server.js) guardando en data.json
    proxy: { '/api': 'http://localhost:3001' }
  }
})
