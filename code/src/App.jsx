import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Github, Linkedin, Mail, BookOpen, Briefcase, X, ChevronDown } from 'lucide-react'
import './App.css'

function App() {  const socialLinks = [
    { name: 'blog', icon: BookOpen, href: '/blog', color: 'text-green-600' },
    { name: 'resume', icon: Briefcase, href: '/2025-christopher_lee.pdf', color: 'text-purple-600' },
    { name: 'github', icon: Github, href: 'https://github.com/thewhitelisted', color: 'text-blue-600' },
    { name: 'linkedin', icon: Linkedin, href: 'https://www.linkedin.com/in/christopherjlee2006/', color: 'text-blue-700' },
    { name: 'email', icon: Mail, href: 'mailto:jleechris06@gmail.com', color: 'text-red-500' },
    { name: 'twitter/x', icon: X, href: 'https://x.com/_chrislee06', color: 'text-black' }
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
          variants={itemVariants}        >          {socialLinks.map((link, index) => {
            const isInternalLink = link.href.startsWith('/') && !link.href.startsWith('http') && !link.href.endsWith('.pdf');
            
            if (isInternalLink) {
              return (
                <motion.div
                  key={link.name}
                  className={`social-link ${link.color}`}
                  whileHover={{ 
                    scale: 1.05,
                    transition: { duration: 0.2 }
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Link to={link.href} className="social-link-inner">
                    <link.icon size={16} className="social-icon" />
                    {link.name}
                  </Link>
                </motion.div>
              );
            }
              return (
              <motion.a
                key={link.name}
                href={link.href}
                target={link.href.startsWith('http') || link.href.endsWith('.pdf') ? '_blank' : undefined}
                rel={link.href.startsWith('http') || link.href.endsWith('.pdf') ? 'noopener noreferrer' : undefined}
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
            );
          })}
        </motion.nav>

        {/* Education Info */}
        <motion.div 
          className="company-info"
          variants={itemVariants}
        >
          <span className="degree">math/bba @ uwaterloo and wilfrid laurier university</span>
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
            <span>about me</span>
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
              i'm christopher, a student studying math and business at uwaterloo and wilfrid laurier university.
              some of my interests include building weather and risk models, coding productivity utilities for myself,
              and quantitative finance.
            </p>
            <p>
              i'm always looking to learn new things and take on interesting projects. feel free to reach out if you
              want to chat or collaborate!
            </p>
          </motion.div>
        </div>
      </motion.section>
    </div>
  )
}

export default App
