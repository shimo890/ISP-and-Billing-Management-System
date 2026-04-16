import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

/**
 * Consistent page layout wrapper with optional header.
 * Ensures responsive padding and theme-aware background.
 */
export default function PageLayout({
  children,
  title,
  subtitle,
  actions,
  headerSticky = true,
  className = '',
}) {
  const { isDark } = useTheme();

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? 'bg-slate-950' : 'bg-slate-50'
      } ${className}`}
    >
      {(title || actions) && (
        <div
          className={`${
            headerSticky ? 'sticky top-0 z-30' : ''
          } backdrop-blur-md border-b transition-all duration-300 ${
            isDark
              ? 'bg-slate-900/95 border-slate-800'
              : 'bg-white/95 border-slate-200'
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {(title || subtitle) && (
                <div>
                  <motion.h1
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-2xl sm:text-3xl font-bold ${
                      isDark ? 'text-slate-50' : 'text-slate-900'
                    }`}
                  >
                    {title}
                  </motion.h1>
                  {subtitle && (
                    <p
                      className={`mt-1 text-sm ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      {subtitle}
                    </p>
                  )}
                </div>
              )}
              {actions && (
                <div className="flex flex-wrap items-center gap-3">
                  {actions}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </div>
    </div>
  );
}
