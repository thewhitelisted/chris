import { plural } from './devlogs.js'

const SEGMENT_OPACITY = [1, 0.7, 0.5, 0.36, 0.26, 0.18]
const segmentOpacity = (index) => SEGMENT_OPACITY[Math.min(index, SEGMENT_OPACITY.length - 1)]

function LanguageBar({ languages }) {
  return (
    <div className="stats-languages">
      <div className="stats-language-bar" aria-hidden="true">
        {languages.map((language, index) => (
          <span
            key={language.name}
            className="stats-language-segment"
            style={{ flexGrow: language.percent, opacity: segmentOpacity(index) }}
          />
        ))}
      </div>
      <ul className="stats-language-legend" aria-label="Languages">
        {languages.map((language, index) => (
          <li key={language.name} className="stats-language">
            <span className="stats-swatch" style={{ opacity: segmentOpacity(index) }} aria-hidden="true" />
            <span className="stats-language-name">{language.name}</span>
            <span className="stats-language-percent">{language.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const SPARK_HEIGHT = 20

function Sparkline({ weekly }) {
  const peak = Math.max(...weekly)
  const total = weekly.reduce((sum, count) => sum + count, 0)
  const label = `Commits per week over the last ${weekly.length} weeks: ${plural(total, 'commit')} in all, at most ${peak} in one week`
  return (
    <svg
      className="stats-sparkline"
      viewBox={`0 0 ${weekly.length} ${SPARK_HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <line className="stats-sparkline-base" x1="0" y1={SPARK_HEIGHT - 0.25} x2={weekly.length} y2={SPARK_HEIGHT - 0.25} />
      {weekly.map((count, week) => {
        const height = peak === 0 ? 0 : (count / peak) * (SPARK_HEIGHT - 1)
        return <rect key={week} className="stats-sparkline-week" x={week + 0.15} y={SPARK_HEIGHT - height} width="0.7" height={height} />
      })}
    </svg>
  )
}

// Language split and commit activity, white on a sticky note. Renders nothing when there is nothing to show.
function ProjectStats({ stats }) {
  if (stats === null) return null
  const { languages, activity } = stats
  if (languages.length === 0 && activity === null) return null
  return (
    <div className="project-stats">
      {languages.length > 0 && <LanguageBar languages={languages} />}
      {activity !== null && (
        <div className="stats-activity">
          <Sparkline weekly={activity.weekly} />
          <span className="stats-activity-text">{plural(activity.last30Days, 'commit')} in the last 30 days</span>
        </div>
      )}
    </div>
  )
}

export default ProjectStats
