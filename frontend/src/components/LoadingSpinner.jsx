import React from 'react';
import { useTheme } from '../context/ThemeContext';

function LoadingSpinner({ size = 'lg', message = 'Loading...', fullScreen = false }) {
  const { isDark } = useTheme();

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const containerClasses = fullScreen
    ? 'min-h-screen flex flex-col items-center justify-center'
    : 'flex flex-col items-center justify-center min-h-[400px]';

  return (
    <div className={`${containerClasses} gap-4 p-8`}>
      <div className={`relative ${sizeClasses[size]}`}>
        <div
          className={`absolute inset-0 rounded-full border-2 ${
            isDark ? 'border-gold-400/20' : 'border-gold-500/20'
          }`}
        />
        <div
          className={`absolute inset-0 rounded-full border-2 border-transparent border-t-gold-600 animate-spin`}
        />
      </div>
      {message && (
        <p
          className={`text-sm font-medium animate-pulse ${
            isDark ? 'text-silver-300' : 'text-slate-600'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export default LoadingSpinner;
