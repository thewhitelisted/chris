import { motion } from 'framer-motion'
import './App.css'

function App() {
  const currentDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <motion.div className="letter" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
      <div className="letter-header">
        <div className="letter-meta">
          <div className="meta-name">Christopher Lee</div>
          <div><span className="redaction redaction-long">XXXXXXXXXXXXXXX</span></div>
          <div className="meta-location">Richmond Hill, ON, <span className="redaction">XXXX</span></div>
          <div className="meta-date">{currentDate}</div>
        </div>
      </div>

      <div className="letter-body">
        <div className="from">From the desk of: <strong>Christopher Lee</strong></div>
        <p>Hello,</p>
        <p>
          If you’re reading this, you’ve stumbled across my website. I’m happy that you’ve taken the
          time and interest to learn more about me. There’s lots of information about me scattered
          around various pages, so enjoy!
        </p>
        <p>
          If you don’t already know, my name is Christopher Lee and I’m currently a student at the 
          <strong> University of Waterloo</strong> and <strong>Wilfrid Laurier University</strong> studying
          <strong> Mathematics and Business</strong>. My professional aspirations lie in
          <strong> quantitative finance</strong> and <strong>risk management</strong>. Furthermore, I hope one day to
          explore philosophy and uncover the secrets of life.
        </p>
        <p>
          Further inquiries, professional or personal, can be directed to my email at
          <strong><a className="email" href="mailto:jleechris06@gmail.com"> jleechris06[at]gmail[dot]com</a></strong>.
        </p>
        <p>Stay golden,</p>
        <p>Christopher Lee</p>
      </div>
    </motion.div>
  )
}

export default App
