// Reports Service - handles reports API calls
import api from './api';

export const reportsService = {
  // Get company reports
  async getCompanyReports(filters = {}) {
    try {
      const queryParams = new URLSearchParams();

      if (filters.start_date) queryParams.append('start_date', filters.start_date);
      if (filters.end_date) queryParams.append('end_date', filters.end_date);

      const response = await api.get(`/reports/company/?${queryParams}`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Get data entry performance reports
  async getDataEntryPerformance(filters = {}) {
    try {
      const queryParams = new URLSearchParams();

      if (filters.start_date) queryParams.append('start_date', filters.start_date);
      if (filters.end_date) queryParams.append('end_date', filters.end_date);
      if (filters.user_id) queryParams.append('user_id', filters.user_id);

      const response = await api.get(`/reports/performance/?${queryParams}`);
      return response;
    } catch (error) {
      throw error;
    }
  }
};