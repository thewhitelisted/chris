import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import contentPlugin from './build/content-plugin.js'

export default defineConfig(({ mode }) => ({
  plugins: mode === 'test' ? [react()] : [react(), contentPlugin()],
  base: '/',
  test: {
    environment: 'happy-dom',
  },
}))
