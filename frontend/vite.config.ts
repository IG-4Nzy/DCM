import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/tsconfig.json', '**/tsconfig.node.json', '**/tsconfig.app.json']
    }
  }
})
