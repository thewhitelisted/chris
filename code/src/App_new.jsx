import { motion } from 'framer-motion'
import { Github, Linkedin, Mail, BookOpen, Briefcase, X, ChevronDown } from 'lucide-react'
import './App.css'

function App() {
  const socialLinks = [
    { name: 'blog', icon: BookOpen, href: '#', color: 'text-green-600' },
    { name: 'portfolio', icon: Briefcase, href: '#', color: 'text-purple-600' },
    { name: 'github', icon: Github, href: '#', color: 'text-blue-600' },
    { name: 'linkedin', icon: Linkedin, href: '#', color: 'text-blue-700' },
    { name: 'email', icon: Mail, href: 'mailto:', color: 'text-red-500' },
    { name: 'twitter/x', icon: X, href: '#', color: 'text-black' }
  ]

  const scrollToAbout = () => {
    document.getElementById('about-section').scrollIntoView({ 
      behavior: 'smooth' 
    })
  }

  const containerVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 }
    }
  }

  return (
    <div className="portfolio-container">
      <motion.div
        className="portfolio-content"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Name */}
        <motion.h1 
          className="name"
          variants={itemVariants}
        >
          christopher lee
        </motion.h1>

        {/* Social Links */}
        <motion.nav 
          className="social-nav"
          variants={itemVariants}
        >
          {socialLinks.map((link, index) => (
            <motion.a
              key={link.name}
              href={link.href}
              className={`social-link ${link.color}`}
              whileHover={{ 
                scale: 1.05,
                transition: { duration: 0.2 }
              }}
              whileTap={{ scale: 0.95 }}
            >
              <link.icon size={16} className="social-icon" />
              {link.name}
            </motion.a>
          ))}
        </motion.nav>

        {/* Education Info */}
        <motion.div 
          className="company-info"
          variants={itemVariants}
        >
          <span className="degree">math/bba @ uwaterloo and wilfrid laurier university</span>
          <span>.</span>
        </motion.div>

        {/* Description */}
        <motion.p 
          className="description"
          variants={itemVariants}
        >
          Just a chill guy who likes to build and model things.
        </motion.p>

        {/* Scroll for More Button */}
        <motion.div
          className="scroll-prompt"
          variants={itemVariants}
        >
          <motion.button
            onClick={scrollToAbout}
            className="scroll-button"
            whileHover={{ 
              scale: 1.05,
              transition: { duration: 0.2 }
            }}
            whileTap={{ scale: 0.95 }}
          >
            <span>scroll for more</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <ChevronDown size={20} />
            </motion.div>
          </motion.button>
        </motion.div>
      </motion.div>

      {/* About Me Section */}
      <motion.section
        id="about-section"
        className="about-section"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
      >
        <div className="about-content">
          <motion.h2
            className="about-title"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
          >
            about me
          </motion.h2>
          <motion.div
            className="about-text"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <p>
              I'm currently pursuing a combined Math/BBA degree at the University of Waterloo 
              and Wilfrid Laurier University. My passion lies in building things that matter - 
              whether it's developing software solutions, creating mathematical models, or 
              exploring new technologies.
            </p>
            <p>
              When I'm not studying or coding, you can find me working on personal projects, 
              learning about emerging tech trends, or just enjoying life as a chill guy who 
              happens to love problem-solving.
            </p>
          </motion.div>
        </div>
      </motion.section>
    </div>
  )
}

export default App
