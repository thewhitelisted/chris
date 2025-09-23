import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Search, FolderOpen } from 'lucide-react'
import { projects } from './projectsData.js'
import StickyNote from './StickyNote.jsx'
import './Projects.css'

function Projects() {
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState('date') // 'name' | 'date' | 'type'
  const [sortDir, setSortDir] = useState('desc') // 'asc' | 'desc'
  const [openNotes, setOpenNotes] = useState([])
  const [nextZIndex, setNextZIndex] = useState(1000)

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'date' ? 'desc' : 'asc')
    }
  }

  const visibleProjects = (() => {
    const filtered = projects.filter(p =>
      p.title.toLowerCase().includes(filter.toLowerCase()) ||
      p.description.toLowerCase().includes(filter.toLowerCase()) ||
      p.technologies.some(tech => tech.toLowerCase().includes(filter.toLowerCase()))
    )
    const sorted = filtered.slice().sort((a, b) => {
      if (sortKey === 'name') {
        const cmp = a.title.localeCompare(b.title)
        return sortDir === 'asc' ? cmp : -cmp
      } else if (sortKey === 'type') {
        const cmp = a.type.localeCompare(b.type)
        return sortDir === 'asc' ? cmp : -cmp
      } else {
        const da = new Date(a.date)
        const db = new Date(b.date)
        const cmp = da - db
        return sortDir === 'asc' ? cmp : -cmp
      }
    })
    return sorted
  })()

  const openStickyNote = (project) => {
    // Don't open if already open
    if (openNotes.find(note => note.project.slug === project.slug)) {
      return
    }

    // Calculate random initial position
    const x = Math.random() * (window.innerWidth - 350)
    const y = Math.random() * (window.innerHeight - 450) + 100

    const newNote = {
      id: Date.now(),
      project,
      position: { x, y },
      zIndex: nextZIndex
    }

    setOpenNotes(prev => [...prev, newNote])
    setNextZIndex(prev => prev + 1)
  }

  const closeStickyNote = (noteId) => {
    setOpenNotes(prev => prev.filter(note => note.id !== noteId))
  }

  const bringToFront = (noteId) => {
    setOpenNotes(prev => prev.map(note => 
      note.id === noteId 
        ? { ...note, zIndex: nextZIndex }
        : note
    ))
    setNextZIndex(prev => prev + 1)
  }

  return (
    <>
      <motion.div className="projects-window" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="titlebar">
          <div className="traffic">
            <span className="light red" />
            <span className="light yellow" />
            <span className="light green" />
          </div>
          <div className="window-title">Projects</div>
        </div>
        <div className="toolbar">
          <div className="breadcrumbs">Home / Projects</div>
          <div className="search-wrap">
            <Search className="search-icon" size={14} />
            <input
              className="toolbar-search"
              placeholder="Search projects"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="explorer-split">
          <section className="explorer-content">
            <div className="list-header">
              <button className={`header-button${sortKey==='name' ? ' active' : ''}`} onClick={()=>handleSort('name')}>
                <span>Name</span>
                <span className="sort-caret">{sortKey==='name' ? (sortDir==='asc' ? '▲' : '▼') : ''}</span>
              </button>
              <button className={`header-button${sortKey==='date' ? ' active' : ''}`} onClick={()=>handleSort('date')}>
                <span>Date Created</span>
                <span className="sort-caret">{sortKey==='date' ? (sortDir==='asc' ? '▲' : '▼') : ''}</span>
              </button>
              <button className={`header-button${sortKey==='type' ? ' active' : ''}`} onClick={()=>handleSort('type')}>
                <span>Type</span>
                <span className="sort-caret">{sortKey==='type' ? (sortDir==='asc' ? '▲' : '▼') : ''}</span>
              </button>
            </div>
            <div className="list-body">
              {visibleProjects.map((project) => (
                <button key={project.slug} className="row" onClick={()=>openStickyNote(project)}>
                  <div className="col name">
                    <FolderOpen className="file-icon" size={16} style={{ color: project.color }} />
                    <span className="file-name">{project.title}</span>
                  </div>
                  <div className="col date">{project.date}</div>
                  <div className="col type">
                    <span className="type-badge">
                      {project.type}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </motion.div>

      <AnimatePresence>
        {openNotes.map((note) => (
          <StickyNote
            key={note.id}
            project={note.project}
            initialPosition={note.position}
            zIndex={note.zIndex}
            onClose={() => closeStickyNote(note.id)}
            onBringToFront={() => bringToFront(note.id)}
          />
        ))}
      </AnimatePresence>
    </>
  )
}

export default Projects



