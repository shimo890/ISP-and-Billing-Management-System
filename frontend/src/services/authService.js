// Auth Service - handles authentication API calls
import api from './api';

export const authService = {
  // Login user
  async login(credentials) {
    try {
      const response = await api.post('/auth/login/', credentials);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Register new user (admin only)
  async register(userData) {
    try {
      const response = await api.post('/auth/register/', userData);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Refresh access token
  async refreshToken(refreshToken) {
    try {
      const response = await api.post('/auth/refresh/', { refreshToken });
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Get user profile
  async getProfile() {
    try {
      const response = await api.get('/auth/profile/');
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Update user profile
  async updateProfile(userData) {
    try {
      const response = await api.put('/auth/profile/', userData);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Logout user
  async logout() {
    try {
      const response = await api.post('/auth/logout/');
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Change password
  async changePassword(passwordData) {
    try {
      const response = await api.post('/auth/change-password/', passwordData);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Accept invitation
  async acceptInvitation(invitationData) {
    try {
      const response = await api.post('/auth/invite/accept/', invitationData);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Validate invitation token
  async validateInvitationToken(token) {
    try {
      const response = await api.post('/auth/invite/validate/', { token });
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Invite new user via email
  async inviteUser(inviteData) {
    try {
      const response = await api.post('/auth/invite/', inviteData);
      return response;
    } catch (error) {
      throw error;
    }
  }
};