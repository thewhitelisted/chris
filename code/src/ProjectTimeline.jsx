import { motion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'
import { projects } from 'virtual:projects'
import { devlogs } from 'virtual:devlogs'
import { formatDate } from './dates.js'
import { entryPath, findTimeline, plural } from './devlogs.js'
import DevlogBody from './DevlogBody.jsx'
import NotFound from './NotFound.jsx'
import ProjectCard from './ProjectCard.jsx'

function ProjectTimeline() {
  const { slug } = useParams()
  const timeline = findTimeline(projects, devlogs, slug)
  if (timeline === null) return <NotFound />
  const { project, entries } = timeline

  return (
    <motion.div className="content-page devlog-timeline" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Link to="/projects" className="devlog-back">← projects</Link>
      <ProjectCard project={project} headingLevel={1} />
      <h2 className="post-heading">Devlog · {plural(entries.length, 'update')}</h2>
      <ol className="devlog-entries">
        {entries.map((entry) => (
          <li key={entry.date} className="devlog-entry">
            <h3 className="devlog-entry-title"><Link to={entryPath(entry)}>{entry.title}</Link></h3>
            <time className="devlog-entry-date" dateTime={entry.date}>{formatDate(entry.date)}</time>
            <DevlogBody entry={entry} />
          </li>
        ))}
      </ol>
    </motion.div>
  )
}

export default ProjectTimeline
