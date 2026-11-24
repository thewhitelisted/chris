import { BrowserRouter } from 'react-router-dom'

function SiteRouter({ children }) {
  return (
    <BrowserRouter basename="/" useTransitions={false}>
      {children}
    </BrowserRouter>
  )
}

export default SiteRouter
