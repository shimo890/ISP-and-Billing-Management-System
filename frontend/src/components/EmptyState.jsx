import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import {
  Inbox,
  Search,
  FileText,
  Users,
  CreditCard,
  Package,
  MessageSquare,
  BarChart3,
} from 'lucide-react';

const iconMap = {
  default: Inbox,
  search: Search,
  invoice: FileText,
  customer: Users,
  payment: CreditCard,
  package: Package,
  feedback: MessageSquare,
  chart: BarChart3,
};

export default function EmptyState({
  icon = 'default',
  title = 'No data yet',
  description = 'Get started by creating your first item.',
  action,
  actionLabel,
  secondaryAction,
  secondaryLabel,
  compact = false,
}) {
  const { isDark } = useTheme();
  const Icon = typeof icon === 'string' ? iconMap[icon] || iconMap.default : icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-8 px-4' : 'py-16 sm:py-20 px-4'
      }`}
    >
      <div
        className={`flex items-center justify-center rounded-2xl mb-4 ${
          isDark ? 'bg-dark-800 text-silver-300' : 'bg-slate-100 text-slate-500'
        } ${compact ? 'w-14 h-14' : 'w-20 h-20'}`}
      >
        <Icon className={compact ? 'w-7 h-7' : 'w-10 h-10'} strokeWidth={1.5} />
      </div>
      <h3
        className={`text-base sm:text-lg font-semibold ${
          isDark ? 'text-white' : 'text-slate-900'
        } mb-2`}
      >
        {title}
      </h3>
      {description && (
        <p
          className={`text-sm max-w-sm mb-6 ${
            isDark ? 'text-silver-300' : 'text-slate-600'
          }`}
        >
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && actionLabel && (
            <button
              type="button"
              onClick={action}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-gold-600 to-cyan-600 hover:from-gold-700 hover:to-cyan-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 dark:focus:ring-offset-dark-900"
            >
              {actionLabel}
            </button>
          )}
          {secondaryAction && secondaryLabel && (
            <button
              type="button"
              onClick={secondaryAction}
              className={`inline-flex items-center justify-center px-4 py-2.5 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 dark:focus:ring-offset-dark-900 ${
                isDark
                  ? 'bg-dark-700 text-silver-300 hover:bg-dark-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
