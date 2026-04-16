import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Download,
  X,
  TrendingUp,
  Calendar,
  DollarSign,
  Filter,
  FileUp,
  AlertTriangle,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorAlert from "../components/ErrorAlert";
import KPICard from "../components/KPICard";
import Pagination from "../components/Pagination";
import EmptyState from "../components/EmptyState";
import { customerService } from "../services/customerService";
import { userService } from "../services/userService";

export default function Customers() {
  const { isDark } = useTheme();
  const { showSuccess, showError } = useNotification();
  const { user, hasPermission } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCustomerType, setFilterCustomerType] = useState("all");
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [formData, setFormData] = useState({
    customer_name: "",
    nid: "",
    email: "",
    address: "",
    customer_type: "",
    company_name: "",
    phone: "",
    total_client: "",
    total_active_client: "",
    previous_total_client: "",
    free_giveaway_client: "",
    default_percentage_share: "",
    contact_person: "",
    status: "active",
    is_active: true,
    kam_id: "",
  });

  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    inactiveCustomers: 0,
  });

  const [salesUsers, setSalesUsers] = useState([]);

  const getUserName = (userId) => {
    if (!userId) return "-";
    const user = salesUsers.find((u) => u.id === parseInt(userId));
    if (!user) return userId;
    return [user.kam_name || userId, user.designation]
      .filter(Boolean)
      .join(" – ");
  };

  const getCustomerTypeDisplay = (customerType) => {
    const choices = {
      bw: "Bandwidth",
      soho: "SOHO/Home",
    };
    return choices[customerType] || customerType || "-";
  };

  const safeText = (value, fallback = "-") => {
    if (value === null || value === undefined) return fallback;
    const str = String(value).trim();
    return str ? str : fallback;
  };

  const truncate = (text, max = 42) => {
    const str = safeText(text, "");
    if (!str) return "-";
    if (str.length <= max) return str;
    return `${str.slice(0, max - 1)}…`;
  };

  const Badge = ({ children, tone = "gray", title }) => {
    const tones = {
      gray: isDark ? "bg-dark-700 text-silver-200" : "bg-gray-100 text-gray-700",
      blue: isDark ? "bg-blue-900/40 text-blue-200" : "bg-blue-50 text-blue-700",
      green: isDark ? "bg-green-900/40 text-green-200" : "bg-green-100 text-green-800",
      red: isDark ? "bg-red-900/40 text-red-200" : "bg-red-100 text-red-800",
      purple: isDark ? "bg-indigo-900/40 text-cyan-200" : "bg-cyan-50 text-cyan-700",
    };
    return (
      <span
        title={title}
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${tones[tone] || tones.gray}`}
      >
        {children}
      </span>
    );
  };

  useEffect(() => {
    // Fetch sales users on mount. Customers are fetched by the pagination/search effects below.
    fetchSalesUsers();
    // Set kam_id from URL params if present
    if (id) {
      setFormData((prev) => ({ ...prev, kam_id: id }));
    }
  }, [id]);

  // Fetch stats (total, active, inactive) once on mount for KPI cards
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || "/api";
        const token = localStorage.getItem("accessToken");
        const headers = { Authorization: `Bearer ${token}` };

        const [allRes, activeRes, inactiveRes] = await Promise.all([
          fetch(`${API_URL}/customers/?limit=1&offset=0`, { headers }),
          fetch(`${API_URL}/customers/?limit=1&offset=0&status=active`, { headers }),
          fetch(`${API_URL}/customers/?limit=1&offset=0&status=inactive`, { headers }),
        ]);

        const getCount = (res) => {
          if (!res.ok) return 0;
          return res.json().then((d) => (d && typeof d.count === "number" ? d.count : 0)).catch(() => 0);
        };

        const [total, activeCustomers, inactiveCustomers] = await Promise.all([
          getCount(allRes),
          getCount(activeRes),
          getCount(inactiveRes),
        ]);

        setStats({
          totalCustomers: total,
          activeCustomers,
          inactiveCustomers,
        });
      } catch {
        setStats((prev) => ({ ...prev }));
      }
    };
    fetchStats();
  }, []);

  // Reset to page 1 when search term or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterCustomerType]);

  // Fetch current page of customers (server-side pagination + search + filters)
  // Optionally pass { page: number } to force a specific page (e.g. after create/delete)
  const fetchCustomers = React.useCallback(async (opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const limit = Math.min(Math.max(1, pageSize), 100);
      const page = opts.page != null ? opts.page : currentPage;
      const offset = (page - 1) * limit;

      const params = {
        limit,
        offset,
      };
      if (searchTerm && searchTerm.trim()) params.search = searchTerm.trim();
      if (filterStatus && filterStatus !== "all") params.status = filterStatus;
      if (filterCustomerType && filterCustomerType !== "all") params.customer_type = filterCustomerType;

      // API interceptor returns response.data, so body is the object directly (no .data wrapper)
      const body = await customerService.getAllCustomers(params);
      if (!body || typeof body !== "object") {
        setCustomers([]);
        setTotalCount(0);
        setTotalPages(1);
        return;
      }
      // Django REST Framework: { count, next, previous, results }; some APIs use .data array
      const results = Array.isArray(body.results)
        ? body.results
        : Array.isArray(body.data)
          ? body.data
          : [];
      const count =
        body.count != null ? body.count : (Array.isArray(body) ? body.length : results.length);
      setCustomers(results);
      setTotalCount(count);
      setTotalPages(Math.ceil(count / limit) || 1);
    } catch (err) {
      setError(err.message || "Failed to fetch customers");
      setCustomers([]);
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm, filterStatus, filterCustomerType]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const fetchSalesUsers = async () => {
    try {
      // Use the /customers/kam/ endpoint to get all KAM list
      const API_URL = import.meta.env.VITE_API_URL || "/api";
      const response = await fetch(`${API_URL}/customers/kam/`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch KAM list");
      }

      const data = await response.json();
      // Handle different response formats
      let users = [];
      if (Array.isArray(data)) {
        users = data;
      } else if (data?.data && Array.isArray(data.data)) {
        users = data.data;
      } else if (data?.results && Array.isArray(data.results)) {
        users = data.results;
      }

      setSalesUsers(users);
    } catch (err) {
      console.error("Error fetching KAM list:", err);
      setSalesUsers([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;

    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: newValue,
      };

      // Handle customer_type changes
      if (name === "customer_type") {
        if (newValue === "bw" || newValue === "soho") {
          // Keep numeric metrics available for both supported customer types
          updated.total_client = updated.total_client || "0";
          updated.total_active_client = updated.total_active_client || "0";
          updated.previous_total_client = updated.previous_total_client || "0";
          updated.free_giveaway_client = updated.free_giveaway_client || "0";
          updated.default_percentage_share =
            updated.default_percentage_share || "0";
        } else {
          // Clear fields for other types
          updated.total_client = "";
          updated.total_active_client = "";
          updated.previous_total_client = "";
          updated.free_giveaway_client = "";
          updated.default_percentage_share = "";
        }
      }

      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      if (editingId) {
        // Update existing customer
        const customerData = {
          customer_name: formData.customer_name,
          nid: formData.nid || null,
          email: formData.email || "",
          address: formData.address || "",
          customer_type: formData.customer_type,
          company_name: formData.company_name,
          phone: formData.phone || "",
          total_client: formData.total_client
            ? parseInt(formData.total_client)
            : null,
          total_active_client: formData.total_active_client
            ? parseInt(formData.total_active_client)
            : null,
          previous_total_client: formData.previous_total_client
            ? parseInt(formData.previous_total_client)
            : null,
          free_giveaway_client: formData.free_giveaway_client
            ? parseInt(formData.free_giveaway_client)
            : null,
          default_percentage_share: formData.default_percentage_share
            ? parseFloat(formData.default_percentage_share)
            : null,
          contact_person: formData.contact_person || "",
          status: formData.status,
          is_active: formData.is_active,
          kam_id: formData.kam_id ? parseInt(formData.kam_id) : null,
        };
        console.log("Updating customer:", editingId, customerData);
        const response = await customerService.updateCustomer(
          editingId,
          customerData
        );
        console.log("Update response:", response);
        showSuccess("Customer updated successfully");
        resetForm();
        // Refresh the list by re-fetching
        await fetchCustomers();
      } else {
        // Create new customer
        const customerData = {
          customer_name: formData.customer_name,
          nid: formData.nid || null,
          email: formData.email || "",
          address: formData.address || "",
          customer_type: formData.customer_type,
          company_name: formData.company_name,
          phone: formData.phone || "",
          total_client: formData.total_client
            ? parseInt(formData.total_client)
            : null,
          total_active_client: formData.total_active_client
            ? parseInt(formData.total_active_client)
            : null,
          previous_total_client: formData.previous_total_client
            ? parseInt(formData.previous_total_client)
            : null,
          free_giveaway_client: formData.free_giveaway_client
            ? parseInt(formData.free_giveaway_client)
            : null,
          default_percentage_share: formData.default_percentage_share
            ? parseFloat(formData.default_percentage_share)
            : null,
          contact_person: formData.contact_person || "",
          status: formData.status,
          is_active: formData.is_active,
          kam_id: formData.kam_id ? parseInt(formData.kam_id) : null,
        };
        console.log("Creating customer with data:", customerData);
        const createdCustomer = await customerService.createCustomer(
          customerData
        );
        showSuccess("Customer created successfully");

        resetForm();
        setCurrentPage(1);
        // Refetch current page and stats (server-side list)
        await fetchCustomers();
        // Refresh stats for KPI cards
        const API_URL = import.meta.env.VITE_API_URL || "/api";
        const token = localStorage.getItem("accessToken");
        const headers = { Authorization: `Bearer ${token}` };
        try {
          const [allRes, activeRes, inactiveRes] = await Promise.all([
            fetch(`${API_URL}/customers/?limit=1&offset=0`, { headers }),
            fetch(`${API_URL}/customers/?limit=1&offset=0&status=active`, { headers }),
            fetch(`${API_URL}/customers/?limit=1&offset=0&status=inactive`, { headers }),
          ]);
          const getCount = (res) => (res.ok ? res.json().then((d) => (d?.count != null ? d.count : 0)) : Promise.resolve(0));
          const [total, activeCustomers, inactiveCustomers] = await Promise.all([
            getCount(allRes),
            getCount(activeRes),
            getCount(inactiveRes),
          ]);
          setStats({ totalCustomers: total, activeCustomers, inactiveCustomers });
        } catch {
          /* keep previous stats */
        }
      }
    } catch (err) {
      console.error("Submit error:", err);
      showError(err.message || "Failed to save customer");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_name: "",
      nid: "",
      email: "",
      address: "",
      customer_type: "",
      company_name: "",
      phone: "",
      total_client: "",
      total_active_client: "",
      previous_total_client: "",
      free_giveaway_client: "",
      default_percentage_share: "",
      contact_person: "",
      status: "active",
      is_active: true,
      kam_id: id || "",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (customer) => {
    const isBwOrSoho =
      customer.customer_type === "bw" || customer.customer_type === "soho";
    setFormData({
      customer_name: customer.customer_name || customer.name || "",
      nid: customer.nid || "",
      email: customer.email || "",
      address: customer.address || "",
      customer_type: customer.customer_type || "",
      company_name: customer.company_name || "",
      phone: customer.phone || "",
      total_client: isBwOrSoho
        ? customer.total_client || "0"
        : customer.total_client || "",
      total_active_client: isBwOrSoho
        ? customer.total_active_client || "0"
        : customer.total_active_client || "",
      previous_total_client: isBwOrSoho
        ? customer.previous_total_client || "0"
        : customer.previous_total_client || "",
      free_giveaway_client: isBwOrSoho
        ? customer.free_giveaway_client || "0"
        : customer.free_giveaway_client || "",
      default_percentage_share: isBwOrSoho
        ? customer.default_percentage_share || "0"
        : customer.default_percentage_share || "",
      contact_person: customer.contact_person || "",
      status: customer.status || "active",
      is_active: customer.is_active !== undefined ? customer.is_active : true,
      kam_id: customer.kam_id || customer.assigned_sales_person || "",
    });
    setEditingId(customer.id);
    setShowForm(true);
  };

  const handleDeleteClick = (customer) => {
    setCustomerToDelete(customer);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;

    try {
      setLoading(true);
      await customerService.deleteCustomer(customerToDelete.id);
      showSuccess("Customer deleted successfully");
      setShowDeleteModal(false);
      setCustomerToDelete(null);
      setCurrentPage(1);
      fetchCustomers();
    } catch (err) {
      showError(err.message || "Failed to delete customer");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setCustomerToDelete(null);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when page size changes
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const formDataToSend = new FormData();
      formDataToSend.append("file", file);

      const API_URL = "http://103.146.220.225:223/api";
      const response = await fetch(`${API_URL}/customers/import_customers/`, {
        method: "POST",
        body: formDataToSend,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // Extract detailed error message
        let errorMessage = "Import failed";

        if (data.error) {
          errorMessage = data.error;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (data.details) {
          errorMessage = data.details;
        } else if (data.message) {
          errorMessage = data.message;
        } else if (typeof data === "object") {
          // Try to extract first error message from object
          const firstKey = Object.keys(data)[0];
          if (firstKey && Array.isArray(data[firstKey])) {
            errorMessage = data[firstKey][0];
          } else if (firstKey && typeof data[firstKey] === "string") {
            errorMessage = data[firstKey];
          }
        }

        throw new Error(errorMessage);
      }

      const successCount = data.success || data.data?.success || 0;
      const failedCount = data.failed || data.data?.failed || 0;
      showSuccess(
        `Customers imported successfully! ${successCount} imported, ${failedCount} failed.`
      );
      if (data.errors && data.errors.length > 0) {
        console.error("Import errors:", data.errors);
      }
      setCurrentPage(1);
      fetchCustomers({ page: 1 });
    } catch (err) {
      showError(err.message || "Failed to import customers");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      const API_URL = "http://103.146.220.225:223/api";

      // Fetch CSV from export API
      const response = await fetch(`${API_URL}/customers/export/`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to export customers");
      }

      // Get the CSV content as blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "customers.csv";
      a.click();
      window.URL.revokeObjectURL(url);

      showSuccess("Customers exported successfully as CSV");
    } catch (err) {
      showError(err.message || "Failed to export customers");
    } finally {
      setLoading(false);
    }
  };

  // Server-side pagination: `customers` is the current page from API; no client-side slice.

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (loading && customers.length === 0) return <LoadingSpinner />;

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
                Customers
              </h1>
              <p
                className={`mt-2 ${
                  isDark ? "text-silver-400" : "text-gray-600"
                }`}
              >
                Manage customer information and details
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {hasPermission("customers:import") && (
                <label className="relative cursor-pointer px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-cyan-600 text-white hover:from-indigo-600 hover:to-cyan-700 shadow-lg hover:shadow-xl">
                  <FileUp size={20} />
                  <span>Import</span>
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
              )}
              {hasPermission("customers:export") && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleExport}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-indigo-500 to-cyan-600 text-white hover:from-indigo-600 hover:to-cyan-700 shadow-lg hover:shadow-xl"
                >
                  <Download size={20} />
                  <span>Export</span>
                </motion.button>
              )}
              {hasPermission("customers:update") && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowForm(!showForm)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-indigo-500 to-cyan-600 text-white hover:from-indigo-600 hover:to-cyan-700 shadow-lg hover:shadow-xl"
                >
                  <Plus size={20} />
                  <span>New Customer</span>
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`mb-6 p-4 rounded-lg ${
              isDark
                ? "bg-green-900/30 border border-green-700 text-green-400"
                : "bg-green-100 border border-green-300 text-green-700"
            }`}
          >
            {success}
          </motion.div>
        )}

        {/* Stats Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <motion.div variants={itemVariants}>
            <KPICard
              title="Total Customers"
              value={stats.totalCustomers}
              icon={Users}
              color="blue"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KPICard
              title="Active Customers"
              value={stats.activeCustomers}
              icon={TrendingUp}
              color="green"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KPICard
              title="Inactive Customers"
              value={stats.inactiveCustomers}
              icon={Calendar}
              color="red"
            />
          </motion.div>
        </motion.div>

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
                  {editingId ? "Edit Customer" : "New Customer"}
                </h2>
                <button
                  onClick={resetForm}
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
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                {/* Section: Identity */}
                <div className="lg:col-span-2">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-silver-200" : "text-gray-800"}`}>
                    Customer Identity
                  </h3>
                  <p className={`text-xs mt-1 ${isDark ? "text-silver-400" : "text-gray-500"}`}>
                    Basic information shown in lists, invoices, and reports.
                  </p>
                </div>

                {/* Customer Name */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? "text-silver-300" : "text-gray-700"}`}>
                    Customer Name <span className={isDark ? "text-red-300" : "text-red-600"}>*</span>
                  </label>
                  <input
                    type="text"
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Rif Enterprise"
                    className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                      isDark
                        ? "bg-dark-700 border-dark-600 text-white placeholder-silver-500 focus:border-gold-500"
                        : "bg-white border-gold-200 text-dark-900 placeholder-gray-400 focus:border-gold-500"
                    } focus:outline-none`}
                  />
                </div>

                {/* Company Name */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? "text-silver-300" : "text-gray-700"}`}>
                    Company Name <span className={isDark ? "text-red-300" : "text-red-600"}>*</span>
                  </label>
                  <input
                    type="text"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Rif Trading Ltd."
                    className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                      isDark
                        ? "bg-dark-700 border-dark-600 text-white placeholder-silver-500 focus:border-gold-500"
                        : "bg-white border-gold-200 text-dark-900 placeholder-gray-400 focus:border-gold-500"
                    } focus:outline-none`}
                  />
                </div>

                {/* Section: Contact & Assignment */}
                <div className="lg:col-span-2 pt-2">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-silver-200" : "text-gray-800"}`}>
                    Contact & Assignment
                  </h3>
                  <p className={`text-xs mt-1 ${isDark ? "text-silver-400" : "text-gray-500"}`}>
                    Optional contact fields help the team reach the right person quickly.
                  </p>
                </div>

                {/* Email */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="name@company.com"
                    className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                      isDark
                        ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                        : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                    } focus:outline-none`}
                  />
                </div>

                {/* NID */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    NID
                  </label>
                  <input
                    type="text"
                    name="nid"
                    value={formData.nid}
                    onChange={handleInputChange}
                    placeholder="e.g., 1234567890"
                    className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                      isDark
                        ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                        : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                    } focus:outline-none`}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+880 XXXXXXXXXX"
                    className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                      isDark
                        ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                        : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                    } focus:outline-none`}
                  />
                </div>

                {/* Contact Person */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    Contact Person
                  </label>
                  <input
                    type="text"
                    name="contact_person"
                    value={formData.contact_person}
                    onChange={handleInputChange}
                    placeholder="e.g., Accounts Dept."
                    className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                      isDark
                        ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                        : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                    } focus:outline-none`}
                  />
                </div>

                {/* Customer Type */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    Customer Type
                  </label>
                  <select
                    name="customer_type"
                    value={formData.customer_type}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                      isDark
                        ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                        : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                    } focus:outline-none`}
                  >
                    <option value="" hidden>
                      Select Customer Type
                    </option>
                    <option value="bw">Bandwidth</option>
                    <option value="soho">SOHO/Home</option>
                  </select>
                </div>

                {/* Metrics fields for supported customer types */}
                {(formData.customer_type === "bw" || formData.customer_type === "soho") && (
                  <>
                    <div>
                      <label
                        className={`block text-sm font-medium mb-2 ${
                          isDark ? "text-silver-300" : "text-gray-700"
                        }`}
                      >
                        Total Client
                      </label>
                      <input
                        type="number"
                        name="total_client"
                        value={formData.total_client}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                          isDark
                            ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                            : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                        } focus:outline-none`}
                      />
                    </div>
                    <div>
                      <label
                        className={`block text-sm font-medium mb-2 ${
                          isDark ? "text-silver-300" : "text-gray-700"
                        }`}
                      >
                        Total Active Client
                      </label>
                      <input
                        type="number"
                        name="total_active_client"
                        value={formData.total_active_client}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                          isDark
                            ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                            : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                        } focus:outline-none`}
                      />
                    </div>
                    <div>
                      <label
                        className={`block text-sm font-medium mb-2 ${
                          isDark ? "text-silver-300" : "text-gray-700"
                        }`}
                      >
                        Previous Total Client
                      </label>
                      <input
                        type="number"
                        name="previous_total_client"
                        value={formData.previous_total_client}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                          isDark
                            ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                            : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                        } focus:outline-none`}
                      />
                    </div>
                    <div>
                      <label
                        className={`block text-sm font-medium mb-2 ${
                          isDark ? "text-silver-300" : "text-gray-700"
                        }`}
                      >
                        Free Giveaway Client
                      </label>
                      <input
                        type="number"
                        name="free_giveaway_client"
                        value={formData.free_giveaway_client}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                          isDark
                            ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                            : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                        } focus:outline-none`}
                      />
                    </div>
                    <div>
                      <label
                        className={`block text-sm font-medium mb-2 ${
                          isDark ? "text-silver-300" : "text-gray-700"
                        }`}
                      >
                        Default Percentage Share
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        name="default_percentage_share"
                        value={formData.default_percentage_share}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                          isDark
                            ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                            : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                        } focus:outline-none`}
                      />
                    </div>
                  </>
                )}

                {/* KAM */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    KAM
                  </label>
                  <select
                    name="kam_id"
                    value={formData.kam_id}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                      isDark
                        ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                        : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                    } focus:outline-none`}
                  >
                    <option value="" hidden>
                      Select a KAM
                    </option>
                    {salesUsers.map((user) => {
                      const fullName = [user.first_name, user.last_name]
                        .filter(Boolean)
                        .join(" ")
                        .trim();
                      const displayName = [fullName || user.kam_name || user.email, user.designation]
                        .filter(Boolean)
                        .join(" – ");
                      return (
                        <option key={user.id} value={user.id}>
                          {displayName}
                        </option>
                      );
                    })}
                  </select>
                  <p
                    className={`text-xs mt-1 ${
                      isDark ? "text-silver-400" : "text-gray-500"
                    }`}
                  >
                    Select the Key Account Manager (Sales Manager or Sales
                    Person)
                  </p>
                </div>

                {/* Status */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                      isDark
                        ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                        : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                    } focus:outline-none`}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Is Active */}
                <div>
                  <label
                    className={`flex items-center text-sm font-medium ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    Is Active
                  </label>
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    Address
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows="3"
                    className={`w-full px-4 py-2 rounded-lg border transition-all duration-300 ${
                      isDark
                        ? "bg-dark-700 border-dark-600 text-white focus:border-gold-500"
                        : "bg-white border-gold-200 text-dark-900 focus:border-gold-500"
                    } focus:outline-none`}
                  />
                </div>

                {/* Submit Buttons */}
                <div className="md:col-span-2 flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={loading}
                    className={`flex-1 px-6 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-indigo-500 to-cyan-600 text-white hover:from-indigo-600 hover:to-cyan-700 shadow-lg hover:shadow-xl`}
                  >
                    {loading
                      ? "Saving..."
                      : editingId
                      ? "Update Customer"
                      : "Create Customer"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={resetForm}
                    className={`flex-1 px-6 py-2 rounded-lg font-medium transition-all duration-300 ${
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

        {/* Search and Filter - Hidden when editing */}
        {!editingId && (
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div
              className={`flex-1 relative ${
                isDark ? "bg-dark-800" : "bg-white"
              } rounded-lg border transition-all duration-300 ${
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
                placeholder="Search by company or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-lg transition-all duration-300 ${
                  isDark
                    ? "bg-dark-800 text-white placeholder-silver-500 focus:outline-none"
                    : "bg-white text-dark-900 placeholder-gray-400 focus:outline-none"
                }`}
              />
            </div>

            <div
              className={`relative ${
                isDark ? "bg-dark-800" : "bg-white"
              } rounded-lg border transition-all duration-300 ${
                isDark ? "border-dark-700" : "border-gold-200"
              }`}
            >
              <Filter
                className={`absolute left-3 top-3 ${
                  isDark ? "text-silver-500" : "text-gray-400"
                }`}
                size={20}
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={`pl-10 pr-4 pe-16 py-2 rounded-lg transition-all duration-300 ${
                  isDark
                    ? "bg-dark-800 text-white focus:outline-none"
                    : "bg-white text-dark-900 focus:outline-none"
                }`}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div
              className={`relative ${
                isDark ? "bg-dark-800" : "bg-white"
              } rounded-lg border transition-all duration-300 ${
                isDark ? "border-dark-700" : "border-gold-200"
              }`}
            >
              <Filter
                className={`absolute left-3 top-3 ${
                  isDark ? "text-silver-500" : "text-gray-400"
                }`}
                size={20}
              />
              <select
                value={filterCustomerType}
                onChange={(e) => setFilterCustomerType(e.target.value)}
                className={`pl-10 pr-8 pe-10 py-2 rounded-lg transition-all duration-300 ${
                  isDark
                    ? "bg-dark-800 text-white focus:outline-none"
                    : "bg-white text-dark-900 focus:outline-none"
                }`}
              >
                <option value="all">All Types</option>
                <option value="bw">Bandwidth</option>
                <option value="soho">SOHO/Home</option>
              </select>
            </div>

            {(searchTerm || filterStatus !== "all" || filterCustomerType !== "all") && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setFilterStatus("all");
                  setFilterCustomerType("all");
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  isDark
                    ? "bg-dark-800 border border-dark-700 text-silver-200 hover:bg-dark-700"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
                title="Clear search and filters"
              >
                Clear
              </motion.button>
            )}
          </div>
        )}

        {/* Customers Table - Hidden when editing */}
        {!editingId && (
          <>
            <div
              className={`rounded-2xl overflow-hidden transition-all duration-300 ${
                isDark
                  ? "bg-dark-800 border border-dark-700"
                  : "bg-white border border-gold-100"
              }`}
            >
              {/* Desktop/tablet table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      className={`border-b sticky top-0 z-10 ${
                        isDark ? "border-dark-700" : "border-gold-100"
                      } ${isDark ? "bg-dark-800" : "bg-white"}`}
                    >
                      <th
                        className={`px-6 py-4 text-left text-sm font-semibold ${
                          isDark ? "text-silver-300" : "text-gray-700"
                        }`}
                      >
                        Customer
                      </th>
                      <th
                        className={`px-6 py-4 text-left text-sm font-semibold ${
                          isDark ? "text-silver-300" : "text-gray-700"
                        }`}
                      >
                        Contact
                      </th>
                      <th
                        className={`px-6 py-4 text-left text-sm font-semibold ${
                          isDark ? "text-silver-300" : "text-gray-700"
                        }`}
                      >
                        Type / KAM
                      </th>
                      <th
                        className={`px-6 py-4 text-left text-sm font-semibold ${
                          isDark ? "text-silver-300" : "text-gray-700"
                        }`}
                      >
                        Status
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
                    {customers.map((customer) => (
                      <tr
                        key={customer.id}
                        className={`border-b transition-colors duration-300 hover:${
                          isDark ? "bg-dark-700" : "bg-gold-50"
                        } ${isDark ? "border-dark-700" : "border-gold-100"}`}
                      >
                        <td
                          className={`px-6 py-4 text-sm font-medium ${
                            isDark ? "text-white" : "text-dark-900"
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="font-semibold">
                              {safeText(customer.customer_name || customer.name)}
                            </span>
                            <span className={isDark ? "text-silver-400 text-xs" : "text-gray-500 text-xs"}>
                              {safeText(customer.company_name)}
                            </span>
                            <span className={isDark ? "text-silver-500 text-xs" : "text-gray-400 text-xs"}>
                              NID: {safeText(customer.nid)}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`px-6 py-4 text-sm ${isDark ? "text-silver-300" : "text-gray-700"}`}
                        >
                          <div className="flex flex-col gap-1">
                            <span className={isDark ? "text-silver-200" : "text-gray-800"}>
                              {safeText(customer.contact_person)}
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              {customer.phone ? (
                                <a
                                  href={`tel:${customer.phone}`}
                                  className={`text-xs hover:underline ${isDark ? "text-blue-300" : "text-blue-700"}`}
                                  title={customer.phone}
                                >
                                  {customer.phone}
                                </a>
                              ) : (
                                <span className={isDark ? "text-silver-500 text-xs" : "text-gray-400 text-xs"}>-</span>
                              )}
                              {customer.email ? (
                                <a
                                  href={`mailto:${customer.email}`}
                                  className={`text-xs hover:underline ${isDark ? "text-blue-300" : "text-blue-700"}`}
                                  title={customer.email}
                                >
                                  {truncate(customer.email, 26)}
                                </a>
                              ) : (
                                <span className={isDark ? "text-silver-500 text-xs" : "text-gray-400 text-xs"}>-</span>
                              )}
                            </div>
                            <span
                              className={isDark ? "text-silver-500 text-xs" : "text-gray-400 text-xs"}
                              title={customer.address || ""}
                            >
                              {truncate(customer.address, 44)}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`px-6 py-4 text-sm ${
                            isDark ? "text-silver-300" : "text-gray-700"
                          }`}
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap gap-2">
                              <Badge tone="purple" title={getCustomerTypeDisplay(customer.customer_type)}>
                                {getCustomerTypeDisplay(customer.customer_type)}
                              </Badge>
                            </div>
                            <div className="flex flex-col">
                              <span className={isDark ? "text-silver-400 text-xs" : "text-gray-500 text-xs"}>
                                KAM
                              </span>
                              <span className={isDark ? "text-silver-200 text-sm" : "text-gray-800 text-sm"}>
                                {safeText(getUserName(customer.kam_id || customer.assigned_sales_person))}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td
                          className={`px-6 py-4 text-sm ${
                            isDark ? "text-silver-300" : "text-gray-700"
                          }`}
                        >
                          <div className="flex flex-col gap-2">
                            <Badge tone={customer.status === "active" ? "green" : "red"}>
                              {safeText(customer.status)}
                            </Badge>
                            <span className={isDark ? "text-silver-500 text-xs" : "text-gray-400 text-xs"}>
                              Active: {customer.is_active ? "Yes" : "No"}
                            </span>
                          </div>
                        </td>
                        <td className={`px-6 py-4 text-sm`}>
                          <div className="flex items-center space-x-2">
                            {hasPermission("customers:update") && (
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleEdit(customer)}
                                className={`p-2 rounded-lg transition-all ${
                                  isDark
                                    ? "bg-dark-700 text-blue-400 hover:bg-dark-600"
                                    : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                }`}
                                title="Edit customer"
                              >
                                <Edit2 size={16} />
                              </motion.button>
                            )}
                            {hasPermission("customers:update") && (
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleDeleteClick(customer)}
                                className={`p-2 rounded-lg transition-all ${
                                  isDark
                                    ? "bg-dark-700 text-red-400 hover:bg-dark-600"
                                    : "bg-red-50 text-red-600 hover:bg-red-100"
                                }`}
                                title="Delete customer"
                              >
                                <Trash2 size={16} />
                              </motion.button>
                            )}
                            {!hasPermission("customers:update") && (
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

              {/* Mobile cards */}
              <div className="lg:hidden divide-y divide-slate-200 dark:divide-slate-700">
                {customers.map((customer) => (
                  <div key={customer.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                          {safeText(customer.customer_name || customer.name)}
                        </p>
                        <p className={isDark ? "text-silver-400 text-xs" : "text-gray-500 text-xs"}>
                          {safeText(customer.company_name)}
                        </p>
                      </div>
                      <Badge tone={customer.status === "active" ? "green" : "red"}>
                        {safeText(customer.status)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="purple">{getCustomerTypeDisplay(customer.customer_type)}</Badge>
                      <Badge tone="blue">KAM: {safeText(getUserName(customer.kam_id || customer.assigned_sales_person))}</Badge>
                    </div>
                    <div className={isDark ? "text-silver-300 text-sm" : "text-gray-700 text-sm"}>
                      <p>{safeText(customer.contact_person)}</p>
                      <p className={isDark ? "text-silver-400 text-xs" : "text-gray-500 text-xs"}>
                        {safeText(customer.phone)} {customer.email ? `• ${truncate(customer.email, 34)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasPermission("customers:update") && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleEdit(customer)}
                          className={`p-2 rounded-lg transition-all ${
                            isDark
                              ? "bg-dark-700 text-blue-400 hover:bg-dark-600"
                              : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                          }`}
                          title="Edit customer"
                        >
                          <Edit2 size={16} />
                        </motion.button>
                      )}
                      {hasPermission("customers:update") && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDeleteClick(customer)}
                          className={`p-2 rounded-lg transition-all ${
                            isDark
                              ? "bg-dark-700 text-red-400 hover:bg-dark-600"
                              : "bg-red-50 text-red-600 hover:bg-red-100"
                          }`}
                          title="Delete customer"
                        >
                          <Trash2 size={16} />
                        </motion.button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pagination */}
            {(totalCount > 0 || customers.length > 0) && (
              <div className="mt-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages || 1}
                  onPageChange={setCurrentPage}
                  pageSize={pageSize}
                  onPageSizeChange={handlePageSizeChange}
                  totalCount={totalCount}
                />
              </div>
            )}

            {!loading && !error && customers.length === 0 && (
              <div
                className={`rounded-2xl overflow-hidden ${
                  isDark
                    ? "bg-dark-800 border border-dark-700"
                    : "bg-white border border-gold-100"
                }`}
              >
                <EmptyState
                  icon="customer"
                  title={
                    totalCount === 0 &&
                    !searchTerm &&
                    filterStatus === "all" &&
                    filterCustomerType === "all"
                      ? "No customers yet"
                      : "No results found"
                  }
                  description={
                    totalCount === 0 &&
                    !searchTerm &&
                    filterStatus === "all" &&
                    filterCustomerType === "all"
                      ? "Get started by adding your first customer."
                      : "Try adjusting your search or filters to find what you're looking for."
                  }
                  action={
                    hasPermission("customers:update") &&
                    totalCount === 0 &&
                    !searchTerm &&
                    filterStatus === "all" &&
                    filterCustomerType === "all"
                      ? () => setShowForm(true)
                      : undefined
                  }
                  actionLabel={
                    hasPermission("customers:update") ? "Add Customer" : undefined
                  }
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleDeleteCancel}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />

            {/* Modal */}
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
                {/* Warning Icon */}
                <div className="flex items-center justify-center mb-4">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center ${
                      isDark ? "bg-red-900/30" : "bg-red-100"
                    }`}
                  >
                    <AlertTriangle
                      className={`w-8 h-8 ${
                        isDark ? "text-red-400" : "text-red-600"
                      }`}
                    />
                  </div>
                </div>

                {/* Title */}
                <h3
                  className={`text-xl font-bold text-center mb-2 ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  Delete Customer
                </h3>

                {/* Message */}
                <p
                  className={`text-center mb-6 ${
                    isDark ? "text-silver-400" : "text-gray-600"
                  }`}
                >
                  Are you sure you want to delete the customer{" "}
                  <span className="font-semibold text-red-500">
                    "{customerToDelete?.customer_name || customerToDelete?.company_name || "this"}"
                  </span>
                  ? This action cannot be undone.
                </p>

                {/* Buttons */}
                <div className="flex space-x-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleDeleteCancel}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-300 ${
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
                    className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-300 bg-red-600 text-white hover:bg-red-700"
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
  );
}
