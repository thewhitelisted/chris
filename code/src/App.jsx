import { motion } from 'framer-motion'
import './App.css'

function App() {
  return (
    <motion.div
      className="home"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="home-name-block">
        <h1 className="home-name">Christopher Lee</h1>
        <div className="home-meta">
          <span className="home-meta-item">University of Waterloo × Wilfrid Laurier</span>
          <span className="home-meta-sep">·</span>
          <span className="home-meta-item">Mathematics & Business</span>
        </div>
      </div>

      <p className="home-bio">
        Hi! This is my website, which contains most important info about me. Feel free to contact
        me using the email addresses below:
      </p>

      <a className="home-email" href="mailto:jleechris06@gmail.com">
        jleechris06[at]gmail[dot]com
      </a>
      <a className='home-email' href="mailto:cj3lee@uwaterloo.ca">
        cj3lee[at]uwaterloo[dot]ca
      </a>
      <a className='home-email' href="mailto:leex5067@mylaurier.ca">
        leex5067[at]mylaurier[dot]ca
      </a>
    </motion.div>
  )
}

export default App
