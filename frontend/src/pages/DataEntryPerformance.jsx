// Data Entry Performance Page Component
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, Users, Activity, Clock,
  Target, CheckCircle, AlertTriangle, Download, RefreshCw
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import KPICard from '../components/KPICard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';

const DataEntryPerformance = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [performanceData, setPerformanceData] = useState({
    summary: {
      total_activities: 0,
      unique_users: 0,
      avg_accuracy: 0,
      total_entries: 0
    },
    user_performance: [],
    period: { start_date: '', end_date: '' }
  });
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    user_id: ''
  });

  useEffect(() => {
    fetchPerformanceData();
  }, [filters]);

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Mock data - replace with actual API call
      setPerformanceData({
        summary: {
          total_activities: 1247,
          unique_users: 8,
          avg_accuracy: 97.8,
          total_entries: 892
        },
        user_performance: [
          {
            user_id: 1,
            username: 'john_doe',
            actions: { create_bill: 45, update_bill: 12, create_customer: 8, update_customer: 15 },
            total_actions: 80,
            accuracy_score: 98.5,
            avg_time: 4.2,
            status: 'excellent'
          },
          {
            user_id: 2,
            username: 'admin',
            actions: { create_bill: 32, update_bill: 18, create_customer: 5, delete_bill: 2 },
            total_actions: 57,
            accuracy_score: 99.2,
            avg_time: 3.8,
            status: 'excellent'
          },
          {
            user_id: 3,
            username: 'manager',
            actions: { create_customer: 12, update_customer: 16, view_reports: 25 },
            total_actions: 53,
            accuracy_score: 97.8,
            avg_time: 5.1,
            status: 'good'
          },
          {
            user_id: 4,
            username: 'data_entry_1',
            actions: { create_bill: 28, update_bill: 8, create_customer: 3 },
            total_actions: 39,
            accuracy_score: 95.2,
            avg_time: 6.2,
            status: 'needs_improvement'
          }
        ],
        period: {
          start_date: filters.start_date || '2024-01-01',
          end_date: filters.end_date || '2024-01-31'
        }
      });
    } catch (err) {
      setError('Failed to fetch performance data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'excellent':
        return 'text-green-600 dark:text-green-400';
      case 'good':
        return 'text-blue-600 dark:text-blue-400';
      case 'needs_improvement':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'poor':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'excellent':
        return <CheckCircle className="h-4 w-4" />;
      case 'good':
        return <TrendingUp className="h-4 w-4" />;
      case 'needs_improvement':
        return <AlertTriangle className="h-4 w-4" />;
      case 'poor':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      {/* Header */}
      <div className={`sticky top-0 z-40 backdrop-blur-md border-b transition-all duration-300 ${
        isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className={`text-3xl sm:text-4xl font-bold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Data Entry Performance
              </h1>
              <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Monitor and analyze data entry efficiency and accuracy
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={fetchPerformanceData}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  isDark
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <RefreshCw size={20} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  isDark
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <Download size={18} />
                <span>Export Report</span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

        {/* Filters */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className={`rounded-2xl p-6 mb-6 transition-all duration-300 ${
            isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Start Date
              </label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
                className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                End Date
              </label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
                className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                User
              </label>
              <select
                value={filters.user_id}
                onChange={(e) => setFilters(prev => ({ ...prev, user_id: e.target.value }))}
                className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="">All Users</option>
                {performanceData.user_performance.map(user => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.username}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={fetchPerformanceData}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Filter
            </button>
          </div>
        </motion.div>

        {/* KPI Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <motion.div variants={itemVariants}>
            <KPICard
              title="Total Activities"
              value={performanceData.summary.total_activities.toLocaleString()}
              icon={Activity}
              color="blue"
              trend="up"
              trendValue="+15.3%"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KPICard
              title="Active Users"
              value={performanceData.summary.unique_users}
              icon={Users}
              color="green"
              trend="up"
              trendValue="+8.7%"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KPICard
              title="Average Accuracy"
              value={`${performanceData.summary.avg_accuracy}%`}
              icon={Target}
              color="purple"
              trend="up"
              trendValue="+2.1%"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KPICard
              title="Total Entries"
              value={performanceData.summary.total_entries}
              icon={BarChart3}
              color="orange"
              trend="up"
              trendValue="+12.8%"
            />
          </motion.div>
        </motion.div>

        {/* Performance Table */}
        <motion.div
          variants={itemVariants}
          className={`rounded-2xl overflow-hidden transition-all duration-300 ${
            isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${
                isDark ? 'bg-gray-700' : 'bg-gray-50'
              }`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    User
                  </th>
                  <th className={`px-6 py-3 text-center text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    Total Actions
                  </th>
                  <th className={`px-6 py-3 text-center text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    Accuracy
                  </th>
                  <th className={`px-6 py-3 text-center text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    Avg Time (min)
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    Status
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    Action Breakdown
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${
                isDark ? 'divide-gray-700' : 'divide-gray-200'
              }`}>
                {performanceData.user_performance.map((user) => (
                  <tr key={user.user_id} className={`hover:${
                    isDark ? 'bg-gray-700' : 'bg-gray-50'
                  } transition-colors duration-200`}>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {user.username}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-center ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {user.total_actions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`text-sm font-semibold ${
                        user.accuracy_score >= 98 ? 'text-green-600' :
                        user.accuracy_score >= 95 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {user.accuracy_score}%
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-center ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {user.avg_time}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`flex items-center ${getStatusColor(user.status)}`}>
                        {getStatusIcon(user.status)}
                        <span className="ml-2 text-sm capitalize">
                          {user.status.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className={`px-6 py-4 text-sm ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(user.actions).map(([action, count]) => (
                          <span
                            key={action}
                            className={`px-2 py-1 text-xs rounded-full ${
                              isDark ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-800'
                            }`}
                          >
                            {action.replace('_', ' ')}: {count}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Performance Insights */}
        <motion.div
          variants={itemVariants}
          className={`rounded-2xl p-6 mt-6 transition-all duration-300 ${
            isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
          }`}
        >
          <h3 className={`text-lg font-semibold mb-4 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Performance Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className={`text-md font-medium mb-3 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Top Performers
              </h4>
              <div className="space-y-2">
                {performanceData.user_performance
                  .filter(user => user.status === 'excellent')
                  .slice(0, 3)
                  .map((user, index) => (
                    <div key={user.user_id} className="flex items-center justify-between">
                      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {index + 1}. {user.username}
                      </span>
                      <span className="text-sm font-semibold text-green-600">
                        {user.accuracy_score}% accuracy
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            <div>
              <h4 className={`text-md font-medium mb-3 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Areas for Improvement
              </h4>
              <div className="space-y-2">
                {performanceData.user_performance
                  .filter(user => user.status === 'needs_improvement')
                  .map((user) => (
                    <div key={user.user_id} className="flex items-center justify-between">
                      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {user.username}
                      </span>
                      <span className="text-sm font-semibold text-yellow-600">
                        {user.accuracy_score}% accuracy
                      </span>
                    </div>
                  ))}
                {performanceData.user_performance.filter(user => user.status === 'needs_improvement').length === 0 && (
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    All users are performing well!
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DataEntryPerformance;