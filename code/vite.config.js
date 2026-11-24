import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, unlinkSync } from 'fs'
import { resolve } from 'path'

const handleMarkdownFiles = () => {
  return {
    name: 'handle-markdown-files',
    closeBundle() {
      const outDir = '..'
      const markdownFiles = ['about.md', 'music.md', 'hobbies.md']
      
      markdownFiles.forEach(file => {
        const rootPath = resolve(outDir, file)
        if (existsSync(rootPath)) {
          unlinkSync(rootPath)
          console.log(`Removed ${file} from root to prevent GitHub Pages conflicts`)
        }
      })
      
      console.log('Preserving papers/ directory structure for React app access')
    }
  }
}

export default defineConfig({
  plugins: [react(), handleMarkdownFiles()],
  base: '/',
  build: {
    outDir: '..',
  },
  test: {
    environment: 'happy-dom',
  },
})
