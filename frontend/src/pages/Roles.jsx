import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Search, Edit2, Trash2, Plus, X } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useNotification } from "../context/NotificationContext";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorAlert from "../components/ErrorAlert";
import Pagination from "../components/Pagination";
import { roleService } from "../services/roleService";

const initialForm = {
  name: "",
  description: "",
  permissions: [],
  is_active: true,
};

export default function Roles() {
  const { isDark } = useTheme();
  const { showError, showSuccess } = useNotification();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [roleChoices, setRoleChoices] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
    fetchRoleChoices();
  }, [currentPage, pageSize, searchTerm]);

  const fetchRoleChoices = async () => {
    try {
      const response = await roleService.getRoleChoices();
      console.log("Role choices API response:", response);

      // Handle different response formats
      if (Array.isArray(response)) {
        setRoleChoices(response);
      } else if (response?.data && Array.isArray(response.data)) {
        setRoleChoices(response.data);
      } else {
        setRoleChoices([]);
      }
    } catch (err) {
      console.error("Error fetching role choices:", err);
      setRoleChoices([]);
    }
  };

  const fetchPermissions = async () => {
    try {
      console.log("Fetching permissions...");
      const response = await roleService.getPermissions();
      console.log("Permissions API response:", response);

      // Handle different response formats
      if (Array.isArray(response)) {
        console.log(
          `Fetched ${response.length} permissions:`,
          response.map((p) => p.name || p)
        );
        setPermissions(response);
      } else if (response?.data && Array.isArray(response.data)) {
        console.log(
          `Fetched ${response.data.length} permissions from data:`,
          response.data.map((p) => p.name || p)
        );
        setPermissions(response.data);
      } else if (response?.results && Array.isArray(response.results)) {
        console.log(
          `Fetched ${response.results.length} permissions from results:`,
          response.results.map((p) => p.name || p)
        );
        setPermissions(response.results);
      } else {
        console.log("No permissions array found in response:", response);
        setPermissions([]);
      }
    } catch (err) {
      console.error("Error fetching permissions:", err);
      setPermissions([]);
    }
  };

  const getPermissionName = (permissionId) => {
    if (!permissionId) return permissionId;
    const permission = permissions.find(
      (p) => p.id === permissionId || p.id === parseInt(permissionId, 10)
    );
    return permission ? permission.name : permissionId;
  };

  const fetchRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await roleService.getRoles({
        page: currentPage,
        pageSize,
        search: searchTerm || undefined,
      });

      // Handle DRF pagination: { count, results } or legacy formats
      const results = Array.isArray(response?.results)
        ? response.results
        : Array.isArray(response?.data)
          ? response.data
          : response?.data?.results && Array.isArray(response.data.results)
            ? response.data.results
            : Array.isArray(response)
              ? response
              : [];
      setRoles(results);

      // Handle DRF pagination: { count, results } or legacy formats
      const count = response?.count ?? response?.pagination?.totalCount ?? response?.data?.count ?? response?.totalCount ?? (Array.isArray(response) ? response.length : 0);
      setTotalCount(count);
      setTotalPages(Math.max(1, Math.ceil((count || 0) / Math.max(1, pageSize))));
    } catch (err) {
      const msg = err?.message || "Failed to fetch roles";
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

  const handlePermissionChange = (permissionId) => {
    setFormData((prev) => {
      const permissions = prev.permissions || [];
      if (permissions.includes(permissionId)) {
        return {
          ...prev,
          permissions: permissions.filter((p) => p !== permissionId),
        };
      } else {
        return {
          ...prev,
          permissions: [...permissions, permissionId],
        };
      }
    });
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name || formData.name.trim() === "") {
      errors.name = "Role name is required";
    }
    if (!formData.description || formData.description.trim() === "") {
      errors.description = "Description is required";
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
        name: formData.name,
        description: formData.description,
        permissions: formData.permissions || [],
        is_active: formData.is_active,
      };
      await roleService.createRole(submitData);
      showSuccess("Role created successfully");
      setFormData(initialForm);
      setFormErrors({});
      setShowForm(false);
      setCurrentPage(1);
      setSearchTerm("");
      fetchRoles();
    } catch (err) {
      console.error("Create role error:", err);
      showError(err.message || "Failed to create role");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name || "",
      description: role.description || "",
      permissions: role.permissions || [],
      is_active: role.is_active !== false,
    });
    setShowEditForm(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingRole) return;
    if (!validateForm()) {
      showError("Please fix the validation errors");
      return;
    }
    try {
      setLoading(true);
      const submitData = {
        name: formData.name,
        description: formData.description,
        permissions: formData.permissions || [],
        is_active: formData.is_active,
      };
      await roleService.updateRole(editingRole.id, submitData);
      showSuccess("Role updated successfully");
      setFormData(initialForm);
      setFormErrors({});
      setShowEditForm(false);
      setEditingRole(null);
      fetchRoles();
    } catch (err) {
      console.error("Update role error:", err);
      showError(err.message || "Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  const handleEditCancel = () => {
    setShowEditForm(false);
    setEditingRole(null);
    setFormData(initialForm);
    setFormErrors({});
  };

  const handleDeleteClick = (role) => {
    setRoleToDelete(role);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!roleToDelete) return;
    try {
      setLoading(true);
      await roleService.deleteRole(roleToDelete.id);
      showSuccess("Role deleted successfully");
      setShowDeleteModal(false);
      setRoleToDelete(null);
      fetchRoles();
    } catch (err) {
      showError(err.message || "Failed to delete role");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setRoleToDelete(null);
  };

  if (loading && roles.length === 0) return <LoadingSpinner />;

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
                Role Management
              </h1>
              <p
                className={`mt-2 ${
                  isDark ? "text-silver-400" : "text-gray-600"
                }`}
              >
                View and manage application roles
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setShowForm(!showForm);
                if (!showForm) {
                  setFormData(initialForm);
                }
              }}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-indigo-500 to-cyan-600 text-white hover:from-indigo-600 hover:to-cyan-700 shadow-lg hover:shadow-xl"
            >
              <Plus size={20} />
              <span>New Role</span>
            </motion.button>
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
                  New Role
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setFormData(initialForm);
                  }}
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
                  <label className="block text-sm font-medium mb-2">
                    Role Name
                  </label>
                  <select
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.name
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select a role name</option>
                    {roleChoices.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                  {formErrors.name && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.description
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.description && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.description}
                    </p>
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
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">
                    Permissions
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                    {permissions.map((permission) => (
                      <label
                        key={permission.id || permission.name}
                        className="flex items-center space-x-2"
                      >
                        <input
                          type="checkbox"
                          checked={
                            formData.permissions?.includes(
                              permission.id || permission.name
                            ) || false
                          }
                          onChange={() =>
                            handlePermissionChange(
                              permission.id || permission.name
                            )
                          }
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm">
                          {permission.name || permission}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2 flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-2 rounded-lg font-medium bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:from-indigo-700 hover:to-cyan-700 disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Create Role"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setFormData(initialForm);
                    }}
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
                  Edit Role
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
                  <label className="block text-sm font-medium mb-2">
                    Role Name
                  </label>
                  <select
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.name
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select a role name</option>
                    {roleChoices.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                  {formErrors.name && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.description
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.description && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.description}
                    </p>
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
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">
                    Permissions
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                    {permissions.map((permission) => (
                      <label
                        key={permission.id || permission.name}
                        className="flex items-center space-x-2"
                      >
                        <input
                          type="checkbox"
                          checked={
                            formData.permissions?.includes(
                              permission.id || permission.name
                            ) || false
                          }
                          onChange={() =>
                            handlePermissionChange(
                              permission.id || permission.name
                            )
                          }
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm">
                          {permission.name || permission}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2 flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-2 rounded-lg font-medium bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
                  >
                    {loading ? "Updating..." : "Update Role"}
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
              placeholder="Search roles..."
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
                    Role Name
                  </th>
                  <th
                    className={`px-6 py-4 text-left text-sm font-semibold ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    Description
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
                    Permissions
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
                {roles.map((role) => (
                  <tr
                    key={role.id}
                    className={`border-b transition-colors duration-300 hover:${
                      isDark ? "bg-dark-700" : "bg-gold-50"
                    } ${isDark ? "border-dark-700" : "border-gold-100"}`}
                  >
                    <td
                      className={`px-6 py-4 text-sm font-medium ${
                        isDark ? "text-white" : "text-dark-900"
                      }`}
                    >
                      {role.id}
                    </td>
                    <td
                      className={`px-6 py-4 text-sm font-medium ${
                        isDark ? "text-white" : "text-dark-900"
                      }`}
                    >
                      {role.name}
                    </td>
                    <td
                      className={`px-6 py-4 text-sm ${
                        isDark ? "text-silver-300" : "text-gray-700"
                      }`}
                    >
                      {role.description || "-"}
                    </td>
                    <td className={`px-6 py-4 text-sm`}>
                      {role.is_active ? "Yes" : "No"}
                    </td>
                    <td
                      className={`px-6 py-4 text-sm ${
                        isDark ? "text-silver-300" : "text-gray-700"
                      }`}
                    >
                      {role.permissions
                        ?.map((id) => getPermissionName(id))
                        .join(", ") || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleEditClick(role)}
                          className={`p-2 rounded-lg transition-all ${
                            isDark
                              ? "bg-dark-700 text-blue-400 hover:bg-dark-600"
                              : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                          }`}
                          title="Edit role"
                        >
                          <Edit2 size={16} />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDeleteClick(role)}
                          className={`p-2 rounded-lg transition-all ${
                            isDark
                              ? "bg-dark-700 text-red-400 hover:bg-dark-600"
                              : "bg-red-50 text-red-600 hover:bg-red-100"
                          }`}
                          title="Delete role"
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
        {roles.length > 0 && (
          <div className="mt-6">
            <Pagination
              currentPage={currentPage}
              totalPages={
                totalPages || Math.ceil((totalCount || roles.length) / pageSize)
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

        {roles.length === 0 && !loading && (
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
              No roles found.
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
                    Delete Role
                  </h3>
                  <p
                    className={`text-center mb-6 ${
                      isDark ? "text-silver-400" : "text-gray-600"
                    }`}
                  >
                    Are you sure you want to delete the role{" "}
                    <span className="font-semibold text-red-500">
                      "{roleToDelete?.name}"
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
    </div>
  );
}
