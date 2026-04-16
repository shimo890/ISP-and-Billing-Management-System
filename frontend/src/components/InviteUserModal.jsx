// Invite User Modal Component
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import { authService } from '../services/authService';
import { userService } from '../services/userService';

const InviteUserModal = ({ isOpen, onClose, onSuccess }) => {
  const { isDark } = useTheme();
  const { showError, showSuccess } = useNotification();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchRoles();
    }
  }, [isOpen]);

  const fetchRoles = async () => {
    try {
      setRolesLoading(true);
      const response = await userService.getAllRoles();
      
      let rolesList = [];
      if (Array.isArray(response)) {
        rolesList = response;
      } else if (response?.data && Array.isArray(response.data)) {
        rolesList = response.data;
      } else if (response?.results && Array.isArray(response.results)) {
        rolesList = response.results;
      }
      
      setRoles(rolesList);
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError('Failed to load roles');
    } finally {
      setRolesLoading(false);
    }
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validation
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!role) {
      setError('Role is required');
      return;
    }

    setLoading(true);

    try {
      // Find the selected role object to get the name
      // Role is stored as ID from the select dropdown, so we need to convert it to name
      let roleName = role;
      
      if (role) {
        // Try to find by ID first (since dropdown uses ID as value)
        const selectedRole = roles.find(r => r.id === parseInt(role) || r.id === role);
        if (selectedRole && selectedRole.name) {
          roleName = selectedRole.name;
        } else {
          // If not found by ID, try by name (fallback)
          const selectedRoleByName = roles.find(r => r.name === role);
          if (selectedRoleByName && selectedRoleByName.name) {
            roleName = selectedRoleByName.name;
          } else {
            // If still not found, show error
            throw new Error('Invalid role selected. Please select a role again.');
          }
        }
      }

      console.log('Sending invitation with:', { email: email.trim(), role: roleName });

      const response = await authService.inviteUser({
        email: email.trim(),
        role: roleName,
      });

      setSuccess(true);
      showSuccess('Invitation sent successfully');

      // Reset form
      setEmail('');
      setRole('');

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      }, 2000);
    } catch (err) {
      console.error('Invite error:', err);
      console.error('Error details:', err.response || err);
      
      // Handle different error formats (from interceptor or direct axios error)
      let errorMessage = 'Failed to send invitation. Please try again.';
      
      if (err.response?.data) {
        // Direct axios error
        errorMessage =
          err.response.data.detail ||
          err.response.data.email?.[0] ||
          err.response.data.role?.[0] ||
          err.response.data.error ||
          errorMessage;
      } else if (err.message) {
        // Error from interceptor (Error object with message)
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('');
    setError('');
    setSuccess(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md ${
              isDark ? 'bg-gray-800' : 'bg-white'
            } rounded-lg shadow-xl`}
          >
            {/* Success State */}
            {success ? (
              <div className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex justify-center mb-4"
                >
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </motion.div>
                <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
                  Invitation Sent!
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  An invitation has been sent to <strong>{email}</strong>
                </p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'} mt-4`}>
                  Closing in a moment...
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div
                  className={`flex items-center justify-between p-6 border-b ${
                    isDark ? 'border-gray-700' : 'border-gray-200'
                  }`}
                >
                  <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Invite User
                  </h2>
                  <button
                    onClick={handleClose}
                    className={`p-1 rounded-lg transition-colors ${
                      isDark
                        ? 'hover:bg-gray-700 text-gray-400'
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  {/* Error Alert */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-start gap-3 p-4 rounded-lg ${
                        isDark ? 'bg-red-900/20' : 'bg-red-50'
                      }`}
                    >
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                        {error}
                      </p>
                    </motion.div>
                  )}

                  {/* Email Field */}
                  <div>
                    <label
                      htmlFor="email"
                      className={`block text-sm font-medium ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      } mb-1`}
                    >
                      Email Address *
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError('');
                      }}
                      placeholder="user@example.com"
                      className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                        isDark
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                      } outline-none`}
                    />
                  </div>

                  {/* Role Field */}
                  <div>
                    <label
                      htmlFor="role"
                      className={`block text-sm font-medium ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      } mb-1`}
                    >
                      Role *
                    </label>
                    {rolesLoading ? (
                      <div className={`w-full px-4 py-2 rounded-lg border ${
                        isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'
                      } flex items-center gap-2`}>
                        <Loader className="h-4 w-4 animate-spin text-blue-500" />
                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Loading roles...
                        </span>
                      </div>
                    ) : (
                      <select
                        id="role"
                        value={role}
                        onChange={(e) => {
                          setRole(e.target.value);
                          setError('');
                        }}
                        className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                          isDark
                            ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                        } outline-none`}
                      >
                        <option value="">Select a role</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || rolesLoading}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                      loading || rolesLoading
                        ? `opacity-50 cursor-not-allowed ${
                            isDark ? 'bg-blue-600' : 'bg-blue-500'
                          }`
                        : `${isDark ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Invitation
                      </>
                    )}
                  </button>

                  {/* Help Text */}
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'} text-center`}>
                    The user will receive an email invitation to create their account
                  </p>
                </form>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default InviteUserModal;
