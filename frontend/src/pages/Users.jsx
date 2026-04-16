import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users as UsersIcon, Search, Edit2, Trash2, Plus, X, Mail } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useNotification } from "../context/NotificationContext";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorAlert from "../components/ErrorAlert";
import Pagination from "../components/Pagination";
import InviteUserModal from "../components/InviteUserModal";
import { userService } from "../services/userService";

const initialForm = {
  username: "",
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  role: "",
  is_active: true,
};

export default function Users() {
  const { isDark } = useTheme();
  const { showError, showSuccess } = useNotification();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [currentPage, pageSize, searchTerm]);

  const fetchRoles = async () => {
    try {
      const response = await userService.getAllRoles();
      // Handle different response formats
      if (Array.isArray(response)) {
        setRoles(response);
      } else if (response?.data && Array.isArray(response.data)) {
        setRoles(response.data);
      } else if (response?.results && Array.isArray(response.results)) {
        setRoles(response.results);
      } else {
        setRoles([]);
      }
    } catch (err) {
      console.error("Error fetching roles:", err);
      // Don't show error notification for roles, just log it
    }
  };

  const getRoleName = (roleId) => {
    if (!roleId) return "-";
    const role = roles.find((r) => r.id === roleId || r.id === parseInt(roleId, 10));
    return role ? role.name : roleId;
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await userService.getUsers({
        page: currentPage,
        pageSize,
        search: searchTerm || undefined,
      });


      // Handle DRF pagination: { count, results } or legacy formats
      const results = Array.isArray(response?.results)
        ? response.results
        : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
            ? response
            : [];
      setUsers(results);

      const count = response?.count ?? response?.pagination?.totalCount ?? response?.totalCount ?? results.length;
      setTotalCount(count);
      setTotalPages(Math.max(1, Math.ceil((count || 0) / Math.max(1, pageSize))));
    } catch (err) {
      const msg = err?.message || "Failed to fetch users";
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.username || formData.username.trim() === "") {
      errors.username = "Username is required";
    }
    if (!formData.email || formData.email.trim() === "") {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }
    if (!formData.password && !editingUser) {
      errors.password = "Password is required";
    } else if (formData.password && formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
    if (!formData.first_name || formData.first_name.trim() === "") {
      errors.first_name = "First name is required";
    }
    if (!formData.last_name || formData.last_name.trim() === "") {
      errors.last_name = "Last name is required";
    }
    if (!formData.role) {
      errors.role = "Role is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      showError("Please fix the validation errors");
      return;
    }
    try {
      setLoading(true);
      const submitData = {
        ...formData,
        role: parseInt(formData.role, 10),
      };
      await userService.createUser(submitData);
      showSuccess("User created successfully");
      setFormData(initialForm);
      setFormErrors({});
      setShowForm(false);
      setCurrentPage(1);
      setSearchTerm("");
      fetchUsers();
    } catch (err) {
      console.error("Create user error:", err);
      showError(err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username || "",
      email: user.email || "",
      password: "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      role: user.role || "",
      is_active: user.is_active !== false,
    });
    setShowEditForm(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!validateForm()) {
      showError("Please fix the validation errors");
      return;
    }
    try {
      setLoading(true);
      const submitData = {
        ...formData,
        role: parseInt(formData.role, 10),
      };
      await userService.updateUser(editingUser.id, submitData);
      showSuccess("User updated successfully");
      setFormData(initialForm);
      setFormErrors({});
      setShowEditForm(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      console.error("Update user error:", err);
      showError(err.message || "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  const handleEditCancel = () => {
    setShowEditForm(false);
    setEditingUser(null);
    setFormData(initialForm);
    setFormErrors({});
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      setLoading(true);
      await userService.deleteUser(userToDelete.id);
      showSuccess("User deleted successfully");
      setShowDeleteModal(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err) {
      showError(err.message || "Failed to delete user");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
  };

  if (loading && users.length === 0) return <LoadingSpinner />;

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? "bg-dark-950" : "bg-gray-50"
      }`}
    >
      {/* Header */}
      <div
        className={`sticky top-0 z-40 backdrop-blur-md border-b transition-all duration-300 ${
          isDark
            ? "bg-dark-900/80 border-dark-700"
            : "bg-white/80 border-gold-100"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1
                className={`text-3xl sm:text-4xl font-serif font-bold ${
                  isDark ? "text-white" : "text-dark-900"
                }`}
              >
                User Management
              </h1>
              <p
                className={`mt-2 ${
                  isDark ? "text-silver-400" : "text-gray-600"
                }`}
              >
                View and manage application users
              </p>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowInviteModal(true)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl"
              >
                <Mail size={20} />
                <span>Invite User</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowForm(!showForm)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-indigo-500 to-cyan-600 text-white hover:from-indigo-600 hover:to-cyan-700 shadow-lg hover:shadow-xl"
              >
                <Plus size={20} />
                <span>New User</span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

        {/* Create Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-8 rounded-2xl p-6 transition-all duration-300 ${
                isDark
                  ? "bg-dark-800 border border-dark-700"
                  : "bg-white border border-gold-100"
              }`}
            >
              <div className="flex items-center justify-between mb-6">
                <h2
                  className={`text-2xl font-serif font-bold ${
                    isDark ? "text-white" : "text-dark-900"
                  }`}
                >
                  New User
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className={`p-2 rounded-lg transition-all duration-300 ${
                    isDark
                      ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  <X size={24} />
                </button>
              </div>
              <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                <div>
                  <label className="block text-sm font-medium mb-2">Username</label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.username
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.username && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.username}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.email
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.email && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.password
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.password && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.password}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.first_name
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.first_name && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.first_name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.last_name
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.last_name && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.last_name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Role</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.role
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select a role</option>
                    {roles.map((role) => (
                      <option key={role.id || role.name} value={role.id}>
                        {role.name || role}
                      </option>
                    ))}
                  </select>
                  {formErrors.role && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.role}</p>
                  )}
                </div>
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleInputChange}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm font-medium">Active</span>
                  </label>
                </div>
                <div className="md:col-span-2 flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-2 rounded-lg font-medium bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:from-indigo-700 hover:to-cyan-700 disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Create User"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => setShowForm(false)}
                    className={`flex-1 px-6 py-2 rounded-lg font-medium ${
                      isDark
                        ? "bg-dark-700 text-gold-400 hover:bg-dark-600"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Cancel
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Form */}
        <AnimatePresence>
          {showEditForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-8 rounded-2xl p-6 transition-all duration-300 ${
                isDark
                  ? "bg-dark-800 border border-dark-700"
                  : "bg-white border border-gold-100"
              }`}
            >
              <div className="flex items-center justify-between mb-6">
                <h2
                  className={`text-2xl font-serif font-bold ${
                    isDark ? "text-white" : "text-dark-900"
                  }`}
                >
                  Edit User
                </h2>
                <button
                  onClick={handleEditCancel}
                  className={`p-2 rounded-lg transition-all duration-300 ${
                    isDark
                      ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  <X size={24} />
                </button>
              </div>
              <form
                onSubmit={handleEditSubmit}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                <div>
                  <label className="block text-sm font-medium mb-2">Username</label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.username
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.username && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.username}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.email
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.email && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Password (leave blank to keep current)</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg border focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.first_name
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.first_name && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.first_name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.last_name
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.last_name && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.last_name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Role</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.role
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select a role</option>
                    {roles.map((role) => (
                      <option key={role.id || role.name} value={role.id}>
                        {role.name || role}
                      </option>
                    ))}
                  </select>
                  {formErrors.role && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.role}</p>
                  )}
                </div>
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleInputChange}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm font-medium">Active</span>
                  </label>
                </div>
                <div className="md:col-span-2 flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-2 rounded-lg font-medium bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
                  >
                    {loading ? "Updating..." : "Update User"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={handleEditCancel}
                    className={`flex-1 px-6 py-2 rounded-lg font-medium ${
                      isDark
                        ? "bg-dark-700 text-gold-400 hover:bg-dark-600"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Cancel
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div
            className={`flex-1 relative ${
              isDark ? "bg-dark-800" : "bg-white"
            } rounded-lg border ${
              isDark ? "border-dark-700" : "border-gold-200"
            }`}
          >
            <Search
              className={`absolute left-3 top-3 ${
                isDark ? "text-silver-500" : "text-gray-400"
              }`}
              size={20}
            />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg ${
                isDark
                  ? "bg-dark-800 text-white placeholder-silver-500"
                  : "bg-white text-dark-900 placeholder-gray-400"
              }`}
            />
          </div>
        </div>

        {/* Table */}
        <div
          className={`rounded-2xl overflow-hidden transition-all duration-300 ${
            isDark
              ? "bg-dark-800 border border-dark-700"
              : "bg-white border border-gold-100"
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  className={`border-b ${
                    isDark ? "border-dark-700" : "border-gold-100"
                  }`}
                >
                  <th
                    className={`px-6 py-4 text-left text-sm font-semibold ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    ID
                  </th>
                  <th
                    className={`px-6 py-4 text-left text-sm font-semibold ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    Username
                  </th>
                  <th
                    className={`px-6 py-4 text-left text-sm font-semibold ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    Email
                  </th>
                  <th
                    className={`px-6 py-4 text-left text-sm font-semibold ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    Role
                  </th>
                  <th
                    className={`px-6 py-4 text-left text-sm font-semibold ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    Active
                  </th>
                  <th
                    className={`px-6 py-4 text-left text-sm font-semibold ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={isDark ? "bg-dark-800" : "bg-white"}>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className={`border-b transition-colors duration-300 hover:${
                      isDark ? "bg-dark-700" : "bg-gold-50"
                    } ${isDark ? "border-dark-700" : "border-gold-100"}`}
                  >
                    <td
                      className={`px-6 py-4 text-sm font-medium ${
                        isDark ? "text-white" : "text-dark-900"
                      }`}
                    >
                      {u.id}
                    </td>
                    <td
                      className={`px-6 py-4 text-sm font-medium ${
                        isDark ? "text-white" : "text-dark-900"
                      }`}
                    >
                      {u.username}
                    </td>
                    <td
                      className={`px-6 py-4 text-sm ${
                        isDark ? "text-silver-300" : "text-gray-700"
                      }`}
                    >
                      {u.email || "-"}
                    </td>
                    <td
                      className={`px-6 py-4 text-sm ${
                        isDark ? "text-silver-300" : "text-gray-700"
                      }`}
                    >
                      {getRoleName(u.role)}
                    </td>
                    <td className={`px-6 py-4 text-sm`}>
                      {u.is_active ? "Yes" : "No"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleEditClick(u)}
                          className={`p-2 rounded-lg transition-all ${
                            isDark
                              ? "bg-dark-700 text-blue-400 hover:bg-dark-600"
                              : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                          }`}
                          title="Edit user"
                        >
                          <Edit2 size={16} />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDeleteClick(u)}
                          className={`p-2 rounded-lg transition-all ${
                            isDark
                              ? "bg-dark-700 text-red-400 hover:bg-dark-600"
                              : "bg-red-50 text-red-600 hover:bg-red-100"
                          }`}
                          title="Delete user"
                        >
                          <Trash2 size={16} />
                        </motion.button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {users.length > 0 && (
          <div className="mt-6">
            <Pagination
              currentPage={currentPage}
              totalPages={
                totalPages || Math.ceil((totalCount || users.length) / pageSize)
              }
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              totalCount={totalCount}
            />
          </div>
        )}

        {users.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`text-center py-12 rounded-2xl ${
              isDark
                ? "bg-dark-800 border border-dark-700"
                : "bg-white border border-gold-100"
            }`}
          >
            <p
              className={`text-lg ${
                isDark ? "text-silver-400" : "text-gray-600"
              }`}
            >
              No users found.
            </p>
          </motion.div>
        )}

        {/* Delete Modal */}
        <AnimatePresence>
          {showDeleteModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleDeleteCancel}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${
                    isDark
                      ? "bg-dark-800 border border-dark-700"
                      : "bg-white border border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-center mb-4">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center ${
                        isDark ? "bg-red-900/30" : "bg-red-100"
                      }`}
                    >
                      <Trash2
                        className={`w-8 h-8 ${
                          isDark ? "text-red-400" : "text-red-600"
                        }`}
                      />
                    </div>
                  </div>
                  <h3
                    className={`text-xl font-bold text-center mb-2 ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Delete User
                  </h3>
                  <p
                    className={`text-center mb-6 ${
                      isDark ? "text-silver-400" : "text-gray-600"
                    }`}
                  >
                    Are you sure you want to delete the user{" "}
                    <span className="font-semibold text-red-500">
                      "{userToDelete?.username}"
                    </span>
                    ? This action cannot be undone.
                  </p>
                  <div className="flex space-x-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDeleteCancel}
                      className={`flex-1 px-4 py-3 rounded-lg font-medium ${
                        isDark
                          ? "bg-dark-700 text-white hover:bg-dark-600"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDeleteConfirm}
                      className="flex-1 px-4 py-3 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700"
                    >
                      Delete
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Invite User Modal */}
      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={() => fetchUsers()}
      />
    </div>
  );
}
