// Activity Log Service - handles activity logging API calls
// Backend: /api/auth/activity-logs/
// Uses limit/offset pagination for performance
import api from './api';

const BASE = '/auth/activity-logs';

export const activityLogService = {
  /**
   * Get activity logs with pagination and filters
   * @param {Object} filters - { page, pageSize, search, action, resource, user_id, start_date, end_date }
   * @returns {Promise<{ results, count, next, previous }>}
   */
  async getActivityLogs(filters = {}) {
    const params = new URLSearchParams();
    const pageSize = Math.min(filters.pageSize || 25, 100);
    const page = filters.page || 1;
    params.append('limit', pageSize);
    params.append('offset', (page - 1) * pageSize);

    if (filters.search) params.append('search', filters.search);
    if (filters.action) params.append('action', filters.action);
    if (filters.resource) params.append('resource', filters.resource);
    if (filters.resource_type) params.append('resource_type', filters.resource_type);
    if (filters.user_id) params.append('user_id', filters.user_id);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.ordering) params.append('ordering', filters.ordering);

    const response = await api.get(`${BASE}/?${params}`);
    return response;
  },

  async getActivityLogById(id) {
    return api.get(`${BASE}/${id}/`);
  },

  /** Get current user's recent activities */
  async getMyActivity() {
    return api.get(`${BASE}/my_activity/`);
  },

  /** Get activity statistics */
  async getStats(filters = {}) {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    const query = params.toString();
    return api.get(`${BASE}/stats/${query ? `?${query}` : ''}`);
  },
};
