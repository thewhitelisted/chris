import { Suspense, useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Home, User, FolderOpen, BookOpen, FileText, Music, Lightbulb, Menu, X } from 'lucide-react'
import Loading from './Loading.jsx'

function Layout() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
    <div className="layout">
      {isMobileMenuOpen && <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)} />}
      <div className="layout-inner">
        <aside className="sidebar">
          <button
            className="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X size={17} /> : <Menu size={17} />}
          </button>

          <div className={`sidebar-inner${isMobileMenuOpen ? ' mobile-open' : ''}`}>
            <div className="brand">cl</div>
            <nav className="nav">
              {navItems.map((item) => {
                const isActive = !item.external && (
                  (item.path === '/blog' && location.pathname.startsWith('/blog')) ||
                  (item.path === '/projects' && location.pathname.startsWith('/projects')) ||
                  location.pathname === item.path
                )
                const IconComponent = item.icon
                const handleClick = () => setIsMobileMenuOpen(false)

                return item.external ? (
                  <a
                    key={item.label}
                    href={item.path}
                    className={`nav-item${isActive ? ' active' : ''}`}
                    target={item.path.endsWith('.pdf') ? '_blank' : undefined}
                    rel={item.path.endsWith('.pdf') ? 'noreferrer noopener' : undefined}
                    onClick={handleClick}
                  >
                    <IconComponent className="nav-icon" size={13} />{item.label}
                  </a>
                ) : (
                  <Link
                    key={item.label}
                    to={item.path}
                    className={`nav-item${isActive ? ' active' : ''}`}
                    onClick={handleClick}
                  >
                    <IconComponent className="nav-icon" size={13} />{item.label}
                  </Link>
                )
              })}
            </nav>
            <div className="divider" />
            <div className="section-label">personal</div>
            <nav className="nav">
              {personalItems.map((item) => {
                const IconComponent = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    className={`nav-item${isActive ? ' active' : ''}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <IconComponent className="nav-icon" size={13} />{item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        <main className="content">
          <div className="sidebar-spacer" />
          <div className={`content-pane${isHome ? ' content-pane-home' : ''}`}>
            <Suspense fallback={<Loading />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout
