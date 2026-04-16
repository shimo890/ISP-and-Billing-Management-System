// Audit Log Service - handles audit trail API calls
// Backend: /api/auth/audit-logs/
// Uses limit/offset pagination for performance
import api from './api';

const BASE = '/auth/audit-logs';

export const auditLogService = {
  /**
   * Get audit logs with pagination and filters
   * @param {Object} filters - { page, pageSize, search, operation, table_name, start_date, end_date }
   * @returns {Promise<{ results, count, next, previous }>}
   */
  async getAuditLogs(filters = {}) {
    const params = new URLSearchParams();
    const pageSize = Math.min(filters.pageSize || 25, 100);
    const page = filters.page || 1;
    params.append('limit', pageSize);
    params.append('offset', (page - 1) * pageSize);

    if (filters.search) params.append('search', filters.search);
    if (filters.operation) params.append('operation', filters.operation);
    if (filters.table_name) params.append('table_name', filters.table_name);
    if (filters.table) params.append('table', filters.table);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.ordering) params.append('ordering', filters.ordering);

    const response = await api.get(`${BASE}/?${params}`);
    return response;
  },

  async getAuditLogById(id) {
    return api.get(`${BASE}/${id}/`);
  },

  /** Get audit trail for a specific record */
  async getByRecord(tableName, recordId) {
    return api.get(`${BASE}/by_record/?table_name=${encodeURIComponent(tableName)}&record_id=${recordId}`);
  },

  /** Get audit statistics */
  async getStats(filters = {}) {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    const query = params.toString();
    return api.get(`${BASE}/stats/${query ? `?${query}` : ''}`);
  },
};
