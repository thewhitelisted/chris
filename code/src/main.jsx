import { StrictMode, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import './index.css'
import './App.css'
import './BlogPost.css'
import './Blog.css'
import './Layout.css'
import './Projects.css'
import Layout from './Layout.jsx'

const App = lazy(() => import('./App.jsx'))
const MarkdownPage = lazy(() => import('./MarkdownPage.jsx'))
const Projects = lazy(() => import('./Projects.jsx'))
const Blog = lazy(() => import('./Blog.jsx'))
const BlogPost = lazy(() => import('./BlogPost.jsx'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router basename="/">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<App />} />
          <Route path="/about" element={<MarkdownPage url="/papers/about.md" />} />
          <Route path="/music" element={<MarkdownPage url="/papers/music.md" />} />
          <Route path="/hobbies" element={<MarkdownPage url="/papers/hobbies.md" />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
        </Route>
      </Routes>
    </Router>
  </StrictMode>,
)
