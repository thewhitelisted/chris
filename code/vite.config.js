import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Replace 'website' with your actual GitHub repository name
  build: {
    outDir: '..',
  },
})
