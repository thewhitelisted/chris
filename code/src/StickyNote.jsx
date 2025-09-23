import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, Github, X, FileText } from 'lucide-react'

function StickyNote({ project, onClose, initialPosition, zIndex, onBringToFront }) {
  const [position, setPosition] = useState(initialPosition)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const handleMouseDown = (e) => {
    if (e.target.closest('.sticky-note-close') || e.target.closest('.sticky-note-link')) {
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
      
      // Keep within viewport bounds
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return '#10b981'
      case 'In Progress': return '#f59e0b'
      case 'Planning': return '#6b7280'
      default: return '#6b7280'
    }
  }

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
        <div className="sticky-note-date">{project.date}</div>
        
        <div 
          className="sticky-note-status"
          style={{ backgroundColor: getStatusColor(project.status) }}
        >
          {project.status}
        </div>
        
        <p className="sticky-note-description">{project.description}</p>
        
        <div className="sticky-note-technologies">
          {project.technologies.map((tech, index) => (
            <span key={index} className="tech-tag">{tech}</span>
          ))}
        </div>
        
        <div className="sticky-note-links">
          {project.github && (
            <a 
              href={project.github} 
              target="_blank" 
              rel="noopener noreferrer"
              className="sticky-note-link"
              onClick={(e) => e.stopPropagation()}
            >
              <Github size={16} />
              <span>Code</span>
            </a>
          )}
          {project.live && (
            <a 
              href={project.live} 
              target="_blank" 
              rel="noopener noreferrer"
              className="sticky-note-link"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={16} />
              <span>Live</span>
            </a>
          )}
          {project.report && (
            <a 
              href={project.report} 
              target="_blank" 
              rel="noopener noreferrer"
              className="sticky-note-link"
              onClick={(e) => e.stopPropagation()}
            >
              <FileText size={16} />
              <span>Report</span>
            </a>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default StickyNote
