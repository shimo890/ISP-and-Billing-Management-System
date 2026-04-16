// App mark (no third-party logo)
import React from 'react';

const KTLLogo = ({ className = '', size = 'default' }) => {
  const sizeClasses = {
    small: 'w-8 h-8',
    default: 'w-12 h-12',
    large: 'w-16 h-16'
  };

  return (
    <div className={`flex items-center justify-center ${sizeClasses[size]} ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-full shadow-lg" />
        <div className="absolute inset-1 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center">
          <span className="text-indigo-600 dark:text-cyan-400 font-bold text-sm leading-none">ISP</span>
        </div>
      </div>
    </div>
  );
};

export default KTLLogo;