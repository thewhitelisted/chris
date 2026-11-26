import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { projects } from 'virtual:projects'
import { devlogs } from 'virtual:devlogs'
import { formatDate } from './dates.js'
import { entryPath, nowProjects, timelinePath } from './devlogs.js'
import ProjectCard from './ProjectCard.jsx'

function Now() {
  const current = nowProjects(projects, devlogs)

  return (
    <motion.div className="content-page now-page" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <h1 className="post-title">Now</h1>
      {current.length === 0 ? (
        <p className="post-paragraph now-empty">Nothing in progress right now. See <Link to="/projects" className="now-inline-link">projects</Link> for finished work.</p>
      ) : (
        <>
          <p className="post-paragraph">What I am working on at the moment.</p>
          <div className="now-projects">
            {current.map(({ project, latest }) => (
              <ProjectCard key={project.slug} project={project} titleTo={latest ? timelinePath(project.slug) : null}>
                {latest ? (
                  <Link to={entryPath(latest)} className="sticky-note-devlog">
                    <span className="sticky-note-devlog-label">Latest update · {formatDate(latest.date)}</span>
                    <span className="sticky-note-devlog-title">{latest.title}</span>
                  </Link>
                ) : (
                  <p className="now-no-entry">No devlog entries yet.</p>
                )}
              </ProjectCard>
            ))}
          </div>
        </>
      )}
    </motion.div>
  )
}

export default Now
