import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, FolderOpen, Lock } from 'lucide-react'
import { projects } from 'virtual:projects'
import { devlogs } from 'virtual:devlogs'
import { entriesOf } from './devlogs.js'
import { formatDate } from './dates.js'
import { useListing, PROJECTS_INITIAL_SORT } from './listing.js'
import { statusLabel } from './projectStatus.js'
import SortHeader from './SortHeader.jsx'
import StickyNote from './StickyNote.jsx'

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'date', label: 'Date Created' },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status' },
]

const searchableText = (project) => [
  project.title,
  project.description,
  ...project.technologies,
  ...(project.status === 'complete' ? [] : [statusLabel(project.status)]),
  ...(project.private ? ['Private'] : []),
]

function Projects() {
  const { query, setQuery, sort, toggleSort, visible } = useListing(projects, searchableText, PROJECTS_INITIAL_SORT)
  const [openNotes, setOpenNotes] = useState([])
  const [nextZIndex, setNextZIndex] = useState(1000)

  const openStickyNote = (project) => {
    if (openNotes.find(note => note.project.slug === project.slug)) {
      return
    }

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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="explorer-split">
          <section className="explorer-content">
            <SortHeader columns={COLUMNS} sort={sort} onSort={toggleSort} />
            <div className="list-body">
              {visible.map((project) => (
                <button key={project.slug} className="row" onClick={()=>openStickyNote(project)}>
                  <div className="col name">
                    <FolderOpen className="file-icon" size={16} style={{ color: project.color }} />
                    <span className="file-name">{project.title}</span>
                    {project.private && <Lock className="private-icon" size={12} aria-label="Private repository" />}
                  </div>
                  <div className="col date">{formatDate(project.date)}</div>
                  <div className="col type">
                    <span className="type-badge">
                      {project.type}
                    </span>
                  </div>
                  <div className="col status">
                    {project.status !== 'complete' && (
                      <span className={`status-badge status-${project.status}`}>{statusLabel(project.status)}</span>
                    )}
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
            entries={entriesOf(devlogs, note.project.slug)}
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
