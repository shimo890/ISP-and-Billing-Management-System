import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function KPICard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendValue, 
  color = 'gold',
  subtitle,
  onClick 
}) {
  const { isDark } = useTheme();

  const colorClasses = {
    gold: isDark ? 'from-gold-600 to-gold-700' : 'from-gold-400 to-gold-500',
    blue: isDark ? 'from-blue-600 to-blue-700' : 'from-blue-400 to-blue-500',
    green: isDark ? 'from-green-600 to-green-700' : 'from-green-400 to-green-500',
    red: isDark ? 'from-red-600 to-red-700' : 'from-red-400 to-red-500',
    purple: isDark ? 'from-cyan-600 to-cyan-700' : 'from-cyan-400 to-cyan-500',
  };

  const bgColor = colorClasses[color] || colorClasses.gold;

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 shadow-sm ${
        isDark
          ? 'bg-dark-900 border border-dark-700 hover:border-gold-500'
          : 'bg-white border border-slate-200 hover:border-gold-400'
      } ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Background Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${bgColor} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

      {/* Content */}
      <div className="relative p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className={`text-sm font-medium mb-1 ${
              isDark ? 'text-silver-300' : 'text-slate-600'
            }`}>
              {title}
            </p>
            {subtitle && (
              <p className={`text-xs ${
                isDark ? 'text-silver-400' : 'text-slate-500'
              }`}>
                {subtitle}
              </p>
            )}
          </div>
          {Icon && (
            <div className={`p-3 rounded-lg bg-gradient-to-br ${bgColor} text-white transform group-hover:scale-110 transition-transform duration-300`}>
              <Icon size={24} />
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mb-4">
          <h3 className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${
            isDark ? 'text-white' : 'text-dark-900'
          }`}>
            {value}
          </h3>
        </div>

        {/* Trend */}
        {trend && trendValue && (
          <div className="flex items-center space-x-2">
            <div className={`flex items-center space-x-1 px-3 py-1 rounded-full ${
              trend === 'up'
                ? isDark
                  ? 'bg-green-900/30 text-green-400'
                  : 'bg-green-100 text-green-700'
                : isDark
                ? 'bg-red-900/30 text-red-400'
                : 'bg-red-100 text-red-700'
            }`}>
              {trend === 'up' ? (
                <TrendingUp size={16} />
              ) : (
                <TrendingDown size={16} />
              )}
              <span className="text-sm font-semibold">{trendValue}</span>
            </div>
            <span className={`text-xs ${
              isDark ? 'text-silver-400' : 'text-slate-500'
            }`}>
              vs last month
            </span>
          </div>
        )}
      </div>

      {/* Bottom Border Accent */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${bgColor} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left`} />
    </motion.div>
  );
}
