import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync, unlinkSync } from 'fs'
import { resolve } from 'path'

// Custom plugin to handle markdown files
const handleMarkdownFiles = () => {
  return {
    name: 'handle-markdown-files',
    closeBundle() {
      // After build, remove only root-level markdown files to prevent GitHub Pages conflicts
      // Keep papers/ directory intact for the React app to access
      const outDir = '..'
      const markdownFiles = ['about.md', 'music.md', 'hobbies.md']
      
      // Remove only root-level markdown files that could conflict with GitHub Pages routing
      markdownFiles.forEach(file => {
        const rootPath = resolve(outDir, file)
        if (existsSync(rootPath)) {
          unlinkSync(rootPath)
          console.log(`Removed ${file} from root to prevent GitHub Pages conflicts`)
        }
      })
      
      // Keep papers/ directory intact - don't remove these files
      console.log('Preserving papers/ directory structure for React app access')
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
