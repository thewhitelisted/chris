import { useLocation } from 'react-router-dom'

function NotFound() {
  const { pathname } = useLocation()
  return (
    <div className="content-page">
      <p className="post-paragraph" role="alert">Could not load {pathname} (not found).</p>
    </div>
  )
}

export default NotFound
