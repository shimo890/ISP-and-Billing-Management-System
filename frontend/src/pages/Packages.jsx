import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Plus, Search, Trash2, X, Edit2, Eye } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorAlert from "../components/ErrorAlert";
import Pagination from "../components/Pagination";
import { packageService } from "../services/packageService";

const initialForm = {
  package_name: "",
  package_type: "",
  service_name: "",
};

export default function Packages() {
  const { isDark } = useTheme();
  const { showSuccess, showError } = useNotification();
  const { hasPermission } = useAuth();

  const getPackageTypeDisplay = (packageType) => {
    const choices = {
      bw: "Bandwidth",
      soho: "SOHO/Home",
    };
    return choices[packageType] || packageType || "-";
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [packages, setPackages] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [packageTypeFilter, setPackageTypeFilter] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingPackage, setViewingPackage] = useState(null);

  // Validate form
  const validateForm = () => {
    const errors = {};
    if (!formData.package_name.trim()) {
      errors.package_name = "Package name is required";
    }
    if (!formData.package_type) {
      errors.package_type = "Package type is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Parse validation errors from API response
  const parseValidationErrors = (errorMessage) => {
    const errors = {};

    // Try to extract field errors from error message
    // Format: "field_name: error message; another_field: error message"
    if (errorMessage && typeof errorMessage === "string") {
      const fieldErrorPattern = /(\w+):\s*([^;]+)/g;
      let match;
      while ((match = fieldErrorPattern.exec(errorMessage)) !== null) {
        const fieldName = match[1].trim();
        const errorMsg = match[2].trim();
        errors[fieldName] = errorMsg;
      }
    }

    return errors;
  };

  useEffect(() => {
    fetchPackages();
    // eslint-disable-next-line
  }, [currentPage, pageSize, searchTerm, packageTypeFilter]);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page: currentPage,
        pageSize,
        search: searchTerm,
      };
      if (packageTypeFilter) {
        params.package_type = packageTypeFilter;
      }

      const response = await packageService.getAllPackages(params);

      console.log("Packages API Response:", response);

      let packagesData = [];
      let totalCountValue = 0;

      // Handle Django REST Framework pagination response
      if (response.results) {
        // DRF PageNumberPagination format: { count, next, previous, results }
        console.log(
          "Using DRF format - count:",
          response.count,
          "results length:",
          response.results.length
        );
        packagesData = response.results;
        totalCountValue = response.count || 0;
      } else if (response.data) {
        console.log("Using data format - data length:", response.data.length);
        packagesData = response.data;
        // Extract pagination info from response
        if (response.pagination) {
          totalCountValue =
            response.pagination.totalCount || response.pagination.total || 0;
        } else if (response.total || response.totalCount) {
          // Pagination info at root level
          totalCountValue = response.total || response.totalCount;
        } else {
          // No pagination info available
          totalCountValue = response.data.length;
        }
      } else if (Array.isArray(response)) {
        console.log("Using array format - length:", response.length);
        packagesData = response;
        totalCountValue = response.length;
      }

      setPackages(packagesData);
      setTotalCount(totalCountValue);
      setTotalPages(Math.ceil(totalCountValue / pageSize));
    } catch (err) {
      console.error("Error fetching packages:", err);
      setError(err.message || "Failed to fetch packages");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      showError("Please fix the validation errors");
      return;
    }
    try {
      setLoading(true);
      await packageService.createPackage({
        package_name: formData.package_name,
        package_type: formData.package_type,
        service_name: formData.service_name?.trim() || null,
        is_active: true,
      });
      showSuccess("Package created successfully");
      setFormData(initialForm);
      setFormErrors({});
      setShowForm(false);
      setCurrentPage(1);
      setSearchTerm("");
      fetchPackages();
    } catch (err) {
      console.error("Create package error:", err);
      // Try to parse field-level validation errors
      const errorMessage = err.message || "Failed to create package";
      const fieldErrors = parseValidationErrors(errorMessage);

      if (Object.keys(fieldErrors).length > 0) {
        setFormErrors(fieldErrors);
        showError("Please fix the validation errors");
      } else {
        showError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (pkg) => {
    setPackageToDelete(pkg);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!packageToDelete) return;
    try {
      setLoading(true);
      await packageService.deletePackage(packageToDelete.id);
      showSuccess("Package deleted successfully");
      setShowDeleteModal(false);
      setPackageToDelete(null);
      fetchPackages();
    } catch (err) {
      showError(err.message || "Failed to delete package");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setPackageToDelete(null);
  };

  const handleEditClick = (pkg) => {
    setEditingPackage(pkg);
    setFormData({
      package_name: pkg.package_name || "",
      package_type: pkg.package_type || "",
      service_name: pkg.service_name ?? "",
    });
    setShowEditForm(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingPackage) return;
    if (!validateForm()) {
      showError("Please fix the validation errors");
      return;
    }
    try {
      setLoading(true);
      await packageService.updatePackage(editingPackage.id, {
        package_name: formData.package_name,
        package_type: formData.package_type,
        service_name: formData.service_name?.trim() || null,
        is_active: true,
      });
      showSuccess("Package updated successfully");
      setFormData(initialForm);
      setFormErrors({});
      setShowEditForm(false);
      setEditingPackage(null);
      setCurrentPage(1);
      setSearchTerm("");
      setPackageTypeFilter("");
      fetchPackages();
    } catch (err) {
      console.error("Update package error:", err);
      // Try to parse field-level validation errors
      const errorMessage = err.message || "Failed to update package";
      const fieldErrors = parseValidationErrors(errorMessage);

      if (Object.keys(fieldErrors).length > 0) {
        setFormErrors(fieldErrors);
        showError("Please fix the validation errors");
      } else {
        showError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditCancel = () => {
    setShowEditForm(false);
    setEditingPackage(null);
    setFormData(initialForm);
  };

  const handleViewClick = (pkg) => {
    setViewingPackage(pkg);
    setShowViewModal(true);
  };

  const handleViewClose = () => {
    setShowViewModal(false);
    setViewingPackage(null);
  };

  if (loading && packages.length === 0) return <LoadingSpinner />;

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? "bg-dark-950" : "bg-gray-50"
      }`}
    >
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
                Packages
              </h1>
              <p
                className={`mt-2 ${
                  isDark ? "text-silver-400" : "text-gray-600"
                }`}
              >
                Manage packages and pricing
              </p>
            </div>
            {hasPermission("packages:write") && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowForm(!showForm)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-indigo-500 to-cyan-600 text-white hover:from-indigo-600 hover:to-cyan-700 shadow-lg hover:shadow-xl"
              >
                <Plus size={20} />
                <span>New Package</span>
              </motion.button>
            )}
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}
        {/* Form */}
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
                  New Package
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
                  <label className="block text-sm font-medium mb-2">Package Name</label>
                  <input
                    type="text"
                    name="package_name"
                    value={formData.package_name}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.package_name
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.package_name && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.package_name}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Package Type</label>
                  <select
                    name="package_type"
                    value={formData.package_type}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.package_type
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select Type</option>
                    <option value="soho">SOHO/Home</option>
                    <option value="bw">Bandwidth</option>
                  </select>
                  {formErrors.package_type && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.package_type}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Service Name</label>
                  <input
                    type="text"
                    name="service_name"
                    value={formData.service_name}
                    onChange={handleInputChange}
                    placeholder="Optional"
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.service_name
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.service_name && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.service_name}
                    </p>
                  )}
                </div>
                <div className="md:col-span-2 flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-2 rounded-lg font-medium bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:from-indigo-700 hover:to-cyan-700 disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Create Package"}
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
                  Edit Package
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
                  <label className="block text-sm font-medium mb-2">Package Name</label>
                  <input
                    type="text"
                    name="package_name"
                    value={formData.package_name}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.package_name
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.package_name && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.package_name}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Package Type</label>
                  <select
                    name="package_type"
                    value={formData.package_type}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.package_type
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select Type</option>
                    <option value="soho">SOHO/Home</option>
                    <option value="bw">Bandwidth</option>
                  </select>
                  {formErrors.package_type && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.package_type}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Service Name</label>
                  <input
                    type="text"
                    name="service_name"
                    value={formData.service_name}
                    onChange={handleInputChange}
                    placeholder="Optional"
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                      formErrors.service_name
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.service_name && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.service_name}
                    </p>
                  )}
                </div>
                <div className="md:col-span-2 flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-2 rounded-lg font-medium bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
                  >
                    {loading ? "Updating..." : "Update Package"}
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
        {/* Search and Filter */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div
            className={`flex-1 min-w-0 relative ${
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
              placeholder="Search packages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg ${
                isDark
                  ? "bg-dark-800 text-white placeholder-silver-500"
                  : "bg-white text-dark-900 placeholder-gray-400"
              }`}
            />
          </div>
          <div
            className={`w-full sm:w-48 ${
              isDark ? "bg-dark-800" : "bg-white"
            } rounded-lg border ${
              isDark ? "border-dark-700" : "border-gold-200"
            }`}
          >
            <select
              value={packageTypeFilter}
              onChange={(e) => setPackageTypeFilter(e.target.value)}
              className={`w-full px-4 py-2 rounded-lg ${
                isDark ? "bg-dark-800 text-white" : "bg-white text-dark-900"
              }`}
            >
              <option value="">All Package Types</option>
              <option value="soho">SOHO/Home</option>
              <option value="bw">Bandwidth</option>
            </select>
          </div>
        </div>
        {/* Table */}
        <div
          className={`rounded-2xl overflow-hidden ${
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
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    Package Name
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    Package Type
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    Service Name
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr
                    key={pkg.id}
                    className={`border-b ${
                      isDark ? "border-dark-700" : "border-gold-100"
                    } hover:${isDark ? "bg-dark-700" : "bg-gold-50"}`}
                  >
                    <td className="px-6 py-4 text-sm font-medium">{pkg.package_name}</td>
                    <td className="px-6 py-4 text-sm">{getPackageTypeDisplay(pkg.package_type)}</td>
                    <td className="px-6 py-4 text-sm">{pkg.service_name ?? "-"}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleViewClick(pkg)}
                          className={`p-2 rounded-lg ${
                            isDark
                              ? "bg-dark-700 text-green-400 hover:bg-dark-600"
                              : "bg-green-50 text-green-600 hover:bg-green-100"
                          }`}
                          title="View package"
                        >
                          <Eye size={16} />
                        </motion.button>
                        {hasPermission("packages:write") && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleEditClick(pkg)}
                            className={`p-2 rounded-lg ${
                              isDark
                                ? "bg-dark-700 text-blue-400 hover:bg-dark-600"
                                : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                            }`}
                            title="Edit package"
                          >
                            <Edit2 size={16} />
                          </motion.button>
                        )}
                        {hasPermission("packages:write") && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDeleteClick(pkg)}
                            className={`p-2 rounded-lg ${
                              isDark
                                ? "bg-dark-700 text-red-400 hover:bg-dark-600"
                                : "bg-red-50 text-red-600 hover:bg-red-100"
                            }`}
                            title="Delete package"
                          >
                            <Trash2 size={16} />
                          </motion.button>
                        )}
                        {!hasPermission("packages:write") && (
                          <span
                            className={`text-xs ${
                              isDark ? "text-gray-500" : "text-gray-400"
                            }`}
                          >
                            No actions
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* Pagination */}
        {packages.length > 0 && (
          <div className="mt-6">
            <Pagination
              currentPage={currentPage}
              totalPages={
                totalPages ||
                Math.ceil((totalCount || packages.length) / pageSize)
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
        {packages.length === 0 && !loading && (
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
              No packages found. Create one to get started!
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
                    Delete Package
                  </h3>
                  <p
                    className={`text-center mb-6 ${
                      isDark ? "text-silver-400" : "text-gray-600"
                    }`}
                  >
                    Are you sure you want to delete the package{" "}
                    <span className="font-semibold text-red-500">
                      "{packageToDelete?.package_name}"
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
        {/* View Modal */}
        <AnimatePresence>
          {showViewModal && viewingPackage && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleViewClose}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  className={`w-full max-w-2xl rounded-2xl p-6 shadow-2xl ${
                    isDark
                      ? "bg-dark-800 border border-dark-700"
                      : "bg-white border border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3
                      className={`text-2xl font-serif font-bold ${
                        isDark ? "text-white" : "text-dark-900"
                      }`}
                    >
                      Package Details
                    </h3>
                    <button
                      onClick={handleViewClose}
                      className={`p-2 rounded-lg transition-all duration-300 ${
                        isDark
                          ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      <X size={24} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Name
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingPackage.package_name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Package Type
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {getPackageTypeDisplay(viewingPackage.package_type) || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Service Name
                      </label>
                      <p
                        className={`text-sm ${
                          isDark ? "text-silver-400" : "text-gray-600"
                        }`}
                      >
                        {viewingPackage.service_name ?? "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end mt-6">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleViewClose}
                      className={`px-6 py-2 rounded-lg font-medium ${
                        isDark
                          ? "bg-dark-700 text-gold-400 hover:bg-dark-600"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      Close
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