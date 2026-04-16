// Auth Context for managing authentication state
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      if (token) {
        try {
          // Set axios default header
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          // Verify token by getting user profile
          const response = await api.get('/users/me/');
          setUser(response);
          setIsAuthenticated(true);
        } catch (error) {
          console.error('Token verification failed:', error);

          // Try to refresh token
          if (refreshToken) {
            try {
              const refreshResponse = await api.post('/auth/refresh/', {
                refresh: refreshToken
              });

              const { access, refresh: newRefreshToken } = refreshResponse;

              localStorage.setItem('accessToken', access);
              localStorage.setItem('refreshToken', newRefreshToken);
              axios.defaults.headers.common['Authorization'] = `Bearer ${access}`;

              // Get user profile after refresh
              const profileResponse = await api.get('/users/me/');
              setUser(profileResponse);
              setIsAuthenticated(true);
            } catch (refreshError) {
              console.error('Token refresh failed:', refreshError);
              logout();
            }
          } else {
            logout();
          }
        }
      }

      setLoading(false);
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (email, password, rememberMe = false) => {
    try {
      const response = await api.post('/auth/login/', {
        email,
        password,
        rememberMe
      });

      const { access, refresh } = response;

      // Store tokens
      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);

      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access}`;

      // Fetch full user profile (role + permissions) for proper permission checks
      const profileResponse = await api.get('/users/me/');
      setUser(profileResponse);
      setIsAuthenticated(true);

      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  };

  // Register function (for admins)
  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register/', userData);

      return {
        success: true,
        user: response.user,
        message: response.message
      };
    } catch (error) {
      console.error('Registration failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed'
      };
    }
  };

  // Logout function
  const logout = () => {
    // Clear localStorage (but keep remembered credentials if rememberMe is true)
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    // Clear axios header
    delete axios.defaults.headers.common['Authorization'];

    setUser(null);
    setIsAuthenticated(false);
  };

  // Update profile function
  const updateProfile = async (profileData) => {
    try {
      // Update user profile using the users endpoint with current user ID
      const response = await api.put(`/users/${user.id}/`, profileData);

      setUser(response);
      return { success: true, message: 'Profile updated successfully' };
    } catch (error) {
      console.error('Profile update failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Profile update failed'
      };
    }
  };

  // Check if user has permission
  const hasPermission = (permission) => {
    if (!user) return false;

    // Extract role name - handle both string and object format
    const roleName = typeof user.role === 'string' ? user.role : (user.role?.name || user.role?.role_name || user.role_name);

    // Super admin has ALL permissions
    if (roleName === 'super_admin' || user.is_superuser) {
      return true;
    }

    // Admin role has all permissions (backend grants admin all perms via M2M)
    if (roleName === 'admin') {
      return true;
    }

    // Check user permissions array (from /users/me/)
    if (user.permissions && Array.isArray(user.permissions)) {
      return user.permissions.includes('all') || user.permissions.includes(permission);
    }

    // Check role permissions if user has a role object with permissions
    if (user.role && user.role.permissions && Array.isArray(user.role.permissions)) {
      return user.role.permissions.includes('all') || user.role.permissions.includes(permission);
    }

    // No permissions data - deny access (secure default)
    return false;
  };

  // Check if user has role
  const hasRole = (role) => {
    if (!user) return false;
    const roleName = typeof user.role === 'string' ? user.role : (user.role?.name || user.role_name);
    return roleName === role;
  };

  // Check if user is admin or super admin
  const isAdmin = () => {
    if (!user) return false;
    const roleName = typeof user.role === 'string' ? user.role : (user.role?.name || user.role_name);
    return user && (user.is_superuser || ['admin', 'super_admin'].includes(roleName));
  };

  // Check if user is super admin
  const isSuperAdmin = () => {
    if (!user) return false;
    const roleName = typeof user.role === 'string' ? user.role : (user.role?.name || user.role_name);
    return user && (user.is_superuser || roleName === 'super_admin');
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    updateProfile,
    hasPermission,
    hasRole,
    isAdmin,
    isSuperAdmin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};