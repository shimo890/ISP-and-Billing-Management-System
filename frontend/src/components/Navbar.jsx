import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'framer-motion';
import { APP_SHORT_TITLE } from '../constants/branding';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/' },
    { name: 'Data Entry', path: '/data-entry' },
    { name: 'Customers', path: '/customers' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className={`sticky top-0 z-50 backdrop-blur-md transition-all duration-300 ${
      isDark 
        ? 'bg-dark-900/80 border-dark-700' 
        : 'bg-white/80 border-gold-100'
    } border-b`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <div className={`w-10 h-10 rounded-lg bg-gradient-premium flex items-center justify-center transform group-hover:scale-110 transition-transform ${
              isDark ? 'shadow-premium' : 'shadow-lg'
            }`}>
              <span className="text-white font-bold text-sm">ISP</span>
            </div>
            <span className={`font-serif text-xl font-bold hidden sm:inline ${
              isDark ? 'text-gold-400' : 'text-gold-600'
            }`}>
              {APP_SHORT_TITLE}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 relative group ${
                  isActive(item.path)
                    ? isDark
                      ? 'text-gold-400 bg-dark-800'
                      : 'text-gold-600 bg-gold-50'
                    : isDark
                    ? 'text-silver-300 hover:text-gold-400'
                    : 'text-gray-700 hover:text-gold-600'
                }`}
              >
                {item.name}
                {isActive(item.path) && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className={`absolute bottom-0 left-0 right-0 h-1 rounded-full bg-gradient-premium`}
                    transition={{ type: 'spring', stiffness: 380, damping: 40 }}
                  />
                )}
              </Link>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-all duration-300 ${
                isDark
                  ? 'bg-dark-800 text-gold-400 hover:bg-dark-700'
                  : 'bg-gold-50 text-gold-600 hover:bg-gold-100'
              }`}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </motion.button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`md:hidden p-2 rounded-lg transition-all duration-300 ${
                isDark
                  ? 'bg-dark-800 text-gold-400 hover:bg-dark-700'
                  : 'bg-gold-50 text-gold-600 hover:bg-gold-100'
              }`}
              aria-label="Toggle menu"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <motion.div
          initial={false}
          animate={isOpen ? 'open' : 'closed'}
          variants={{
            open: { opacity: 1, height: 'auto' },
            closed: { opacity: 0, height: 0 },
          }}
          transition={{ duration: 0.3 }}
          className="md:hidden overflow-hidden"
        >
          <div className={`py-4 space-y-2 border-t ${
            isDark ? 'border-dark-700' : 'border-gold-100'
          }`}>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`block px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  isActive(item.path)
                    ? isDark
                      ? 'text-gold-400 bg-dark-800'
                      : 'text-gold-600 bg-gold-50'
                    : isDark
                    ? 'text-silver-300 hover:text-gold-400 hover:bg-dark-800'
                    : 'text-gray-700 hover:text-gold-600 hover:bg-gold-50'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </nav>
  );
}
