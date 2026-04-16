// User Service - handles user management API calls
import api from './api';

export const userService = {
  // Get all users (admin only)
  async getUsers(filters = {}) {
    try {
      const queryParams = new URLSearchParams();

      if (filters.search) queryParams.append('search', filters.search);
      if (filters.role) queryParams.append('role', filters.role);
      if (filters.is_active !== undefined) queryParams.append('is_active', filters.is_active);
      // Backend uses limit/offset
      const pageSize = filters.pageSize ?? 10;
      const page = filters.page ?? 1;
      const limit = Math.min(Math.max(1, pageSize), 100);
      const offset = (page - 1) * limit;
      queryParams.append('limit', limit);
      queryParams.append('offset', offset);

      const response = await api.get(`/users/?${queryParams}`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  /** Field / account staff (roles used for KAM assignment). */
  async getFieldStaffUsers() {
    try {
      return await api.get('/users/field-staff/');
    } catch (error) {
      throw error;
    }
  },

  // Get user by ID
  async getUserById(id) {
    try {
      const response = await api.get(`/users/${id}/`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Create new user (admin only)
  async createUser(userData) {
    try {
      const response = await api.post('/users/', userData);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Update user
  async updateUser(id, userData) {
    try {
      const response = await api.put(`/users/${id}/`, userData);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Delete user (admin only)
  async deleteUser(id) {
    try {
      const response = await api.delete(`/users/${id}/`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Get all roles (admin only)
  async getRoles() {
    try {
      const response = await api.get('/users/roles/all/');
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Get all roles from auth endpoint
  async getAllRoles() {
    try {
      const response = await api.get('/auth/roles/');
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Get user permissions
  async getUserPermissions(id) {
    try {
      const response = await api.get(`/users/${id}/permissions/`);
      return response;
    } catch (error) {
      throw error;
    }
  }
};