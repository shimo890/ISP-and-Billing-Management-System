import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, RefreshCw, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

function ErrorAlert({ message, type = 'error', onClose, onRetry, onDismiss, className = '' }) {
  const { isDark } = useTheme();
  const handleClose = onClose || onDismiss;

  const alertStyles = {
    error: isDark
      ? 'bg-red-950/40 border-red-800 text-red-200'
      : 'bg-red-50 border-red-200 text-red-800',
    success: isDark
      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
      : 'bg-green-50 border-green-200 text-green-800',
    warning: isDark
      ? 'bg-amber-950/40 border-amber-800 text-amber-200'
      : 'bg-amber-50 border-amber-200 text-amber-800',
    info: isDark
      ? 'bg-indigo-950/40 border-indigo-800 text-indigo-200'
      : 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const iconStyles = {
    error: isDark ? 'text-red-400' : 'text-red-600',
    success: isDark ? 'text-green-400' : 'text-green-600',
    warning: isDark ? 'text-amber-400' : 'text-amber-600',
    info: isDark ? 'text-blue-400' : 'text-blue-600',
  };

  const icons = {
    error: AlertCircle,
    success: CheckCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const Icon = icons[type];

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border animate-fade-in ${alertStyles[type]} ${className}`}
      role="alert"
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconStyles[type]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gold-500 rounded"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        )}
      </div>
      {handleClose && (
        <button
          type="button"
          onClick={handleClose}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-gold-500"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default ErrorAlert;
