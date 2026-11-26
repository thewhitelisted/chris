import { motion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'
import { projects } from 'virtual:projects'
import { devlogs } from 'virtual:devlogs'
import { formatDate } from './dates.js'
import { findEntry, timelinePath } from './devlogs.js'
import DevlogBody from './DevlogBody.jsx'
import NotFound from './NotFound.jsx'

function DevlogEntry() {
  const { slug, date } = useParams()
  const found = findEntry(projects, devlogs, slug, date)
  if (found === null) return <NotFound />
  const { project, entry } = found

  return (
    <motion.div className="content-page devlog-entry-page" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Link to={timelinePath(project.slug)} className="devlog-back">← {project.title} devlog</Link>
      <h1 className="post-title devlog-entry-page-title">{entry.title}</h1>
      <p className="devlog-entry-meta">
        <span className="devlog-tag" style={{ '--tag-color': project.color }}>{project.title}</span>
        <time className="devlog-entry-date" dateTime={entry.date}>{formatDate(entry.date)}</time>
      </p>
      <DevlogBody entry={entry} />
    </motion.div>
  )
}

export default DevlogEntry
