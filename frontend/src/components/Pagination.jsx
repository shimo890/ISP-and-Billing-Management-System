import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  pageSize,
  onPageSizeChange,
  totalCount 
}) {
  const { isDark } = useTheme();

  const pageSizeOptions = [10, 25, 50, 100];
  const startRecord = totalCount === 0 ? 0 : Math.max(1, (currentPage - 1) * pageSize + 1);
  const endRecord = totalCount === 0 ? 0 : Math.min(currentPage * pageSize, totalCount);

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border transition-all duration-300 ${
      isDark
        ? 'bg-dark-900 border-dark-700'
        : 'bg-white border-slate-200'
    }`}>
      {/* Records Info */}
      <div className={`text-sm ${isDark ? 'text-silver-300' : 'text-slate-600'}`}>
        Showing <span className="font-semibold">{startRecord}</span> to <span className="font-semibold">{endRecord}</span> of <span className="font-semibold">{totalCount}</span> records
      </div>

      {/* Page Size Selector */}
      <div className="flex items-center gap-2">
        <label className={`text-sm font-medium ${isDark ? 'text-silver-300' : 'text-slate-700'}`}>
          Records per page:
        </label>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
          className={`px-3 py-1 rounded-lg border text-sm transition-all duration-300 ${
            isDark
              ? 'bg-dark-700 border-dark-600 text-white focus:border-gold-500'
              : 'bg-white border-gold-200 text-dark-900 focus:border-gold-500'
          } focus:outline-none`}
        >
          {pageSizeOptions.map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`p-2 rounded-lg transition-all duration-300 ${
            currentPage === 1
              ? isDark
                ? 'bg-dark-700 text-silver-500 cursor-not-allowed opacity-50'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
              : isDark
              ? 'bg-dark-700 text-blue-400 hover:bg-dark-600'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <ChevronLeft size={18} />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            return pageNum;
          }).map(pageNum => (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-300 ${
                currentPage === pageNum
                  ? isDark
                    ? 'bg-blue-600 text-white'
                    : 'bg-gold-600 text-white'
                  : isDark
                  ? 'bg-dark-700 text-silver-300 hover:bg-dark-600'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {pageNum}
            </button>
          ))}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`p-2 rounded-lg transition-all duration-300 ${
            currentPage === totalPages
              ? isDark
                ? 'bg-dark-700 text-silver-500 cursor-not-allowed opacity-50'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
              : isDark
              ? 'bg-dark-700 text-blue-400 hover:bg-dark-600'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Page Info */}
      <div className={`text-sm font-medium ${isDark ? 'text-silver-300' : 'text-slate-700'}`}>
        Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
      </div>
    </div>
  );
}
