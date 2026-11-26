import { lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './Layout.jsx'

const App = lazy(() => import('./App.jsx'))
const MarkdownPage = lazy(() => import('./MarkdownPage.jsx'))
const Projects = lazy(() => import('./Projects.jsx'))
const Blog = lazy(() => import('./Blog.jsx'))
const BlogPost = lazy(() => import('./BlogPost.jsx'))
const ProjectTimeline = lazy(() => import('./ProjectTimeline.jsx'))
const DevlogEntry = lazy(() => import('./DevlogEntry.jsx'))
const Now = lazy(() => import('./Now.jsx'))

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<App />} />
        <Route path="/about" element={<MarkdownPage url="/papers/about.md" />} />
        <Route path="/music" element={<MarkdownPage url="/papers/music.md" />} />
        <Route path="/hobbies" element={<MarkdownPage url="/papers/hobbies.md" />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:slug" element={<ProjectTimeline />} />
        <Route path="/projects/:slug/:date" element={<DevlogEntry />} />
        <Route path="/now" element={<Now />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
      </Route>
    </Routes>
  )
}

export default AppRoutes
