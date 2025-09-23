import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, User, FolderOpen, BookOpen, FileText, Music, Heart, Lightbulb } from 'lucide-react'
import './Layout.css'

function Layout() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  const navItems = [
    { path: '/', label: 'home', icon: Home },
    { path: '/about', label: 'about', icon: User },
    { path: '/projects', label: 'projects', icon: FolderOpen },
    { path: '/blog', label: 'blog', icon: BookOpen },
    { path: '/2025-christopher_lee.pdf', label: 'resume', icon: FileText, external: true },
  ]

  const personalItems = [
    { path: '/music', label: 'music', icon: Music },
    { path: '/hobbies', label: 'interests', icon: Lightbulb },
  ]

  const isBlogRoute = location.pathname.startsWith('/blog')
  const isProjectsRoute = location.pathname.startsWith('/projects')
  const isAboutRoute = location.pathname === '/about'
  const isMusicRoute = location.pathname === '/music'
  const isHobbiesRoute = location.pathname === '/hobbies'
  const isExplorerRoute = isBlogRoute || isProjectsRoute
  const isPaginatedRoute = isBlogRoute || isAboutRoute || isMusicRoute || isHobbiesRoute
  const isFullWidthRoute = isExplorerRoute || isPaginatedRoute

  // Disable page scroll on home route; restore elsewhere
  useEffect(() => {
    if (isHome) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    } else {
      document.body.style.overflow = ''
    }
  }, [isHome])

  return (
    <div className={`layout${isExplorerRoute ? ' blog-mode' : ''}`}>
      <div className="layout-inner">
      <aside className="sidebar">
        <div className="sidebar-inner">
          <div className="brand">navigator</div>
          <nav className="nav">
            {navItems.map((item) => {
              const isActive = !item.external && (
                (item.path === '/blog' && location.pathname.startsWith('/blog')) ||
                (item.path === '/projects' && location.pathname.startsWith('/projects')) ||
                location.pathname === item.path
              )
              const IconComponent = item.icon
              return item.external ? (
                <a key={item.label} href={item.path} className={`nav-item${isActive ? ' active' : ''}`} target={item.path.startsWith('http') || item.path.startsWith('mailto:') || item.path.endsWith('.pdf') ? '_blank' : undefined} rel={item.path.startsWith('http') || item.path.endsWith('.pdf') ? 'noreferrer noopener' : undefined}>
                  <IconComponent className="nav-icon" size={14} />{item.label}
                </a>
              ) : (
                <Link key={item.label} to={item.path} className={`nav-item${isActive ? ' active' : ''}`}>
                  <IconComponent className="nav-icon" size={14} />{item.label}
                </Link>
              )
            })}
          </nav>
          <div className="divider" />
          <div className="section-label">personal</div>
          <nav className="nav">
            {personalItems.map((item) => {
              const IconComponent = item.icon
              const isActive = item.path && location.pathname === item.path
              
              return item.disabled ? (
                <span key={item.label} className="nav-item disabled">
                  <IconComponent className="nav-icon" size={14} />{item.label}
                </span>
              ) : (
                <Link key={item.label} to={item.path} className={`nav-item${isActive ? ' active' : ''}`}>
                  <IconComponent className="nav-icon" size={14} />{item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>
      <main className="content">
        <div className="sidebar-spacer" />
        <div className="content-pane" style={{ marginTop: 'var(--paper-top-offset)' }}>
          {isFullWidthRoute ? (
            <Outlet />
          ) : (
            <motion.div
              key={location.pathname}
              className="paper"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              style={isHome ? { overflow: 'hidden', marginLeft: '-6px' } : undefined}
            >
              <Outlet />
            </motion.div>
          )}
        </div>
      </main>
      </div>
    </div>
  )
}

export default Layout


