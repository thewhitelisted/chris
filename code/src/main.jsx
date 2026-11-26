import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import './BlogPost.css'
import './Blog.css'
import './Layout.css'
import './Projects.css'
import './Devlogs.css'
import AppRoutes from './AppRoutes.jsx'
import SiteRouter from './SiteRouter.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SiteRouter>
      <AppRoutes />
    </SiteRouter>
  </StrictMode>,
)
