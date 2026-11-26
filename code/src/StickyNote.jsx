import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { formatDate } from './dates.js'
import { projectDateLine, statusLabel } from './projectStatus.js'
import { plural, timelinePath } from './devlogs.js'
import ProjectLinks from './ProjectLinks.jsx'
import ProjectStats from './ProjectStats.jsx'

function StickyNote({ project, entries, onClose, initialPosition, zIndex, onBringToFront }) {
  const [position, setPosition] = useState(initialPosition)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const handleMouseDown = (e) => {
    if (e.target.closest('.sticky-note-close') || e.target.closest('.sticky-note-link') || e.target.closest('.sticky-note-devlog')) {
      return
    }
    
    setIsDragging(true)
    onBringToFront()
    
    const rect = dragRef.current.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return
      
      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y
      
      const maxX = window.innerWidth - 320
      const maxY = window.innerHeight - 400
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  return (
    <motion.div
      ref={dragRef}
      className="sticky-note"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: zIndex,
        backgroundColor: project.color || '#3b82f6',
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      exit={{ scale: 0, rotate: 10 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onMouseDown={handleMouseDown}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="sticky-note-header">
        <div className="sticky-note-pin"></div>
        <button 
          className="sticky-note-close"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
        >
          <X size={16} />
        </button>
      </div>
      
      <div className="sticky-note-content">
        <h3 className="sticky-note-title">{project.title}</h3>
        <div className="sticky-note-date">{projectDateLine(project)}</div>
        {project.status !== 'complete' && <div className="sticky-note-status">{statusLabel(project.status)}</div>}
        
        <p className="sticky-note-description">{project.description}</p>
        
        <div className="sticky-note-technologies">
          {project.technologies.map((tech, index) => (
            <span key={index} className="tech-tag">{tech}</span>
          ))}
        </div>
        
        <ProjectStats stats={project.stats} />

        {entries.length > 0 && (
          <Link to={timelinePath(project.slug)} className="sticky-note-devlog">
            <span className="sticky-note-devlog-label">Latest update · {formatDate(entries[0].date)}</span>
            <span className="sticky-note-devlog-title">{entries[0].title}</span>
            <span className="sticky-note-devlog-count">{plural(entries.length, 'update')}</span>
          </Link>
        )}

        <ProjectLinks project={project} />
      </div>
    </motion.div>
  )
}

export default StickyNote
