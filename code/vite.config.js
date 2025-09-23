import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync, unlinkSync } from 'fs'
import { resolve } from 'path'

// Custom plugin to handle markdown files
const handleMarkdownFiles = () => {
  return {
    name: 'handle-markdown-files',
    closeBundle() {
      // After build, remove markdown files from root to prevent GitHub Pages conflicts
      const outDir = '..'
      const markdownFiles = ['about.md', 'music.md', 'hobbies.md']
      
      markdownFiles.forEach(file => {
        const rootPath = resolve(outDir, file)
        if (existsSync(rootPath)) {
          unlinkSync(rootPath)
          console.log(`Removed ${file} from root to prevent GitHub Pages conflicts`)
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), handleMarkdownFiles()],
  base: '/', // Replace 'website' with your actual GitHub repository name
  build: {
    outDir: '..',
  },
})
