// Audit Logs Page - Data change audit trail (create, update, delete)
// Uses real API with limit/offset pagination for performance
import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Search, RefreshCw, ChevronLeft, ChevronRight, Plus, Pencil, Trash2
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import { auditLogService } from '../services/auditLogService';

const PAGE_SIZE_OPTIONS = [15, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

const AuditLogs = () => {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [count, setCount] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    search: '',
    operation: '',
    table_name: '',
    start_date: '',
    end_date: '',
  });

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await auditLogService.getAuditLogs({
        page: filters.page,
        pageSize: filters.pageSize,
        search: filters.search || undefined,
        operation: filters.operation || undefined,
        table_name: filters.table_name || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
        ordering: '-created_at',
      });

      setLogs(response.results || []);
      setCount(response.count ?? 0);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch audit logs');
      setLogs([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.pageSize, filters.search, filters.operation, filters.table_name, filters.start_date, filters.end_date]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key !== 'page' && key !== 'pageSize' ? { page: 1 } : {}),
    }));
  };

  const getOperationIcon = (op) => {
    switch (op) {
      case 'create': return <Plus className="h-4 w-4" />;
      case 'update': return <Pencil className="h-4 w-4" />;
      case 'delete': return <Trash2 className="h-4 w-4" />;
      default: return <ClipboardList className="h-4 w-4" />;
    }
  };

  const getOperationColor = (op) => {
    switch (op) {
      case 'create': return 'text-green-600 dark:text-green-400';
      case 'update': return 'text-amber-600 dark:text-amber-400';
      case 'delete': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatChanges = (changes) => {
    if (!changes || typeof changes !== 'object') return null;
    const entries = Object.entries(changes);
    if (entries.length === 0) return null;
    return entries.map(([k, v]) => {
      const val = Array.isArray(v) ? `${v[0]} → ${v[1]}` : String(v);
      return { field: k, change: val };
    });
  };

  const totalPages = Math.ceil(count / filters.pageSize) || 1;
  const startItem = (filters.page - 1) * filters.pageSize + 1;
  const endItem = Math.min(filters.page * filters.pageSize, count);

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold dark:text-white">Audit Logs</h1>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Data change history (create, update, delete). Track who changed what and when.
          </p>
        </div>
        <button
          onClick={fetchAuditLogs}
          disabled={loading}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

      {/* Filters */}
      <div
        className={`rounded-xl p-4 mb-6 transition-colors ${
          isDark ? 'bg-dark-600 border border-dark-500' : 'bg-gray-50 border border-gray-200'
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="User, table, record..."
                className={`w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-dark-700 border-dark-500 text-white' : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Operation
            </label>
            <select
              value={filters.operation}
              onChange={(e) => handleFilterChange('operation', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg text-sm ${
                isDark ? 'bg-dark-700 border-dark-500 text-white' : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="">All</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Table
            </label>
            <input
              type="text"
              value={filters.table_name}
              onChange={(e) => handleFilterChange('table_name', e.target.value)}
              placeholder="e.g. customer_master"
              className={`w-full px-4 py-2 border rounded-lg text-sm ${
                isDark ? 'bg-dark-700 border-dark-500 text-white' : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Start Date
            </label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg text-sm ${
                isDark ? 'bg-dark-700 border-dark-500 text-white' : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              End Date
            </label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg text-sm ${
                isDark ? 'bg-dark-700 border-dark-500 text-white' : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        className={`rounded-xl overflow-hidden border transition-colors ${
          isDark ? 'bg-dark-700 border-dark-600' : 'bg-white border-gray-200'
        }`}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-600">
                <thead className={isDark ? 'bg-dark-600' : 'bg-gray-50'}>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Operation</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Table</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Record</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Changes</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-dark-600' : 'divide-gray-200'}`}>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={`px-4 py-12 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        No audit logs found. Audit logs are created when data is modified.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <React.Fragment key={log.id}>
                        <tr
                          className={`cursor-pointer ${isDark ? 'hover:bg-dark-600' : 'hover:bg-gray-50'}`}
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {log.user_username || log.user_email || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 ${getOperationColor(log.operation)}`}>
                              {getOperationIcon(log.operation)}
                              {log.operation_display || log.operation}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono">
                            {log.table_name || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                            #{log.record_id}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                            {log.changes && typeof log.changes === 'object' && Object.keys(log.changes).length > 0
                              ? `${Object.keys(log.changes).length} field(s) changed`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                          </td>
                        </tr>
                        {expandedId === log.id && (log.changes || log.old_values || log.new_values) && (
                          <tr className={isDark ? 'bg-dark-600/50' : 'bg-gray-50'}>
                            <td colSpan={6} className="px-4 py-4">
                              <div className="text-sm space-y-2">
                                {formatChanges(log.changes)?.map(({ field, change }) => (
                                  <div key={field} className="font-mono">
                                    <span className="text-amber-600 dark:text-amber-400">{field}:</span>{' '}
                                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{change}</span>
                                  </div>
                                ))}
                                {(!log.changes || Object.keys(log.changes).length === 0) && log.old_values && (
                                  <div>
                                    <span className="font-medium text-gray-500">Old values:</span>
                                    <pre className="mt-1 p-2 rounded bg-black/10 text-xs overflow-x-auto max-h-32">
                                      {JSON.stringify(log.old_values, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {(!log.changes || Object.keys(log.changes).length === 0) && log.new_values && (
                                  <div>
                                    <span className="font-medium text-gray-500">New values:</span>
                                    <pre className="mt-1 p-2 rounded bg-black/10 text-xs overflow-x-auto max-h-32">
                                      {JSON.stringify(log.new_values, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {count > 0 && (
              <div
                className={`px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-t ${
                  isDark ? 'border-dark-600 bg-dark-600' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Showing {startItem}–{endItem} of {count}
                  </span>
                  <select
                    value={filters.pageSize}
                    onChange={(e) => handleFilterChange('pageSize', Number(e.target.value))}
                    className={`text-sm border rounded px-2 py-1 ${
                      isDark ? 'bg-dark-700 border-dark-500 text-white' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    {PAGE_SIZE_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s} per page</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleFilterChange('page', filters.page - 1)}
                    disabled={filters.page <= 1}
                    className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isDark ? 'hover:bg-dark-500 text-gray-300' : 'hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className={`px-3 py-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Page {filters.page} of {totalPages}
                  </span>
                  <button
                    onClick={() => handleFilterChange('page', filters.page + 1)}
                    disabled={filters.page >= totalPages}
                    className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isDark ? 'hover:bg-dark-500 text-gray-300' : 'hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
