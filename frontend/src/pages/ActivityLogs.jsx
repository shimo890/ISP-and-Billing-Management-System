// Activity Logs Page - User activity tracking (API requests, logins, actions)
// Uses real API with limit/offset pagination for performance
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Search, RefreshCw, User, FileText, Eye, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import { activityLogService } from '../services/activityLogService';

const PAGE_SIZE_OPTIONS = [15, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

const ActivityLogs = () => {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [count, setCount] = useState(0);
  const [nextUrl, setNextUrl] = useState(null);
  const [prevUrl, setPrevUrl] = useState(null);
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    search: '',
    action: '',
    resource: '',
    start_date: '',
    end_date: '',
  });

  const fetchActivityLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await activityLogService.getActivityLogs({
        page: filters.page,
        pageSize: filters.pageSize,
        search: filters.search || undefined,
        action: filters.action || undefined,
        resource: filters.resource || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
        ordering: '-created_at',
      });

      setLogs(response.results || []);
      setCount(response.count ?? 0);
      setNextUrl(response.next || null);
      setPrevUrl(response.previous || null);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch activity logs');
      setLogs([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.pageSize, filters.search, filters.action, filters.resource, filters.start_date, filters.end_date]);

  useEffect(() => {
    fetchActivityLogs();
  }, [fetchActivityLogs]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key !== 'page' && key !== 'pageSize' ? { page: 1 } : {}),
    }));
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'login':
      case 'logout':
        return <User className="h-4 w-4" />;
      case 'create':
      case 'update':
      case 'delete':
        return <FileText className="h-4 w-4" />;
      case 'read':
        return <Eye className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'login':
        return 'text-green-600 dark:text-green-400';
      case 'logout':
        return 'text-gray-600 dark:text-gray-400';
      case 'create':
        return 'text-blue-600 dark:text-blue-400';
      case 'update':
        return 'text-amber-600 dark:text-amber-400';
      case 'delete':
        return 'text-red-600 dark:text-red-400';
      case 'read':
        return 'text-cyan-600 dark:text-cyan-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatDetails = (details) => {
    if (!details || typeof details !== 'object') return '—';
    const { method, path } = details;
    if (method && path) return `${method} ${path}`;
    return JSON.stringify(details).slice(0, 60) + (JSON.stringify(details).length > 60 ? '…' : '');
  };

  const totalPages = Math.ceil(count / filters.pageSize) || 1;
  const startItem = (filters.page - 1) * filters.pageSize + 1;
  const endItem = Math.min(filters.page * filters.pageSize, count);

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold dark:text-white">Activity Logs</h1>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            User API requests and actions. Auto-captured by the system.
          </p>
        </div>
        <button
          onClick={fetchActivityLogs}
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
                placeholder="User, resource, IP..."
                className={`w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-dark-700 border-dark-500 text-white' : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Action
            </label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg text-sm ${
                isDark ? 'bg-dark-700 border-dark-500 text-white' : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="">All</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="read">Read</option>
            </select>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-dark-600' : 'divide-gray-200'}`}>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={`px-4 py-12 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        No activity logs found.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className={isDark ? 'hover:bg-dark-600' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {log.user_username || log.user_email || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 ${getActionColor(log.action)}`}>
                            {getActionIcon(log.action)}
                            {log.action_display || log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                          {log.resource || '—'}
                          {log.resource_id != null && ` #${log.resource_id}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate" title={JSON.stringify(log.details)}>
                          {formatDetails(log.details)}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">
                          {log.ip_address || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                        </td>
                      </tr>
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

export default ActivityLogs;
