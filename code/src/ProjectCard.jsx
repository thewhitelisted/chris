import { Link } from 'react-router-dom'
import { projectDateLine, statusLabel } from './projectStatus.js'
import ProjectLinks from './ProjectLinks.jsx'
import ProjectStats from './ProjectStats.jsx'

// A project in sticky-note colours, fixed in the page. titleTo makes the title a link.
function ProjectCard({ project, titleTo, headingLevel, children }) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <section className="project-card" style={{ backgroundColor: project.color }}>
      <Heading className="sticky-note-title project-card-title">
        {titleTo ? <Link to={titleTo}>{project.title}</Link> : project.title}
      </Heading>
      <div className="sticky-note-date">{projectDateLine(project)}</div>
      {project.status !== 'complete' && <div className="sticky-note-status">{statusLabel(project.status)}</div>}
      <p className="sticky-note-description">{project.description}</p>
      <ProjectStats stats={project.stats} />
      {children}
      <ProjectLinks project={project} />
    </section>
  )
}

export default ProjectCard
