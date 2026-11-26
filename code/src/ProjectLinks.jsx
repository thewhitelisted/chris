import { ExternalLink, Github, FileText, Lock } from 'lucide-react'

function ProjectLinks({ project }) {
  const stop = (e) => e.stopPropagation()
  return (
    <div className="sticky-note-links">
      {project.github && (
        <a href={project.github} target="_blank" rel="noopener noreferrer" className="sticky-note-link" onClick={stop}>
          <Github size={16} />
          <span>Code</span>
        </a>
      )}
      {project.private && (
        <span className="sticky-note-private">
          <Lock size={16} />
          <span>Source private</span>
        </span>
      )}
      {project.live && (
        <a href={project.live} target="_blank" rel="noopener noreferrer" className="sticky-note-link" onClick={stop}>
          <ExternalLink size={16} />
          <span>Live</span>
        </a>
      )}
      {project.report && (
        <a href={project.report} target="_blank" rel="noopener noreferrer" className="sticky-note-link" onClick={stop}>
          <FileText size={16} />
          <span>Report</span>
        </a>
      )}
    </div>
  )
}

export default ProjectLinks
