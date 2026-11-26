import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import contentPlugin from './build/content-plugin.js'

export default defineConfig(({ mode }) => ({
  plugins: mode === 'test'
    ? [react()]
    : [react(), contentPlugin({
        postsDir: fileURLToPath(new URL('../posts', import.meta.url)),
        devlogsDir: fileURLToPath(new URL('../devlogs', import.meta.url)),
      })],
  resolve: mode === 'test'
    ? {
        alias: {
          'virtual:posts': fileURLToPath(new URL('./build/fixtures/virtual-posts.js', import.meta.url)),
          'virtual:projects': fileURLToPath(new URL('./build/fixtures/virtual-projects.js', import.meta.url)),
          'virtual:devlogs': fileURLToPath(new URL('./build/fixtures/virtual-devlogs.js', import.meta.url)),
        },
      }
    : {},
  base: '/',
  test: {
    environment: 'happy-dom',
  },
}))
