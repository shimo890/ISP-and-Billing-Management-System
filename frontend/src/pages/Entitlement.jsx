import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Download,
  Plus,
  Users,
  Wifi,
  FileText,
  Search,
  Edit2,
  Trash2,
  Eye,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import ErrorAlert from "../components/ErrorAlert";
import Pagination from "../components/Pagination";
import { billService } from "../services/billService";
import { customerService } from "../services/customerService";

export default function Entitlement() {
  const { isDark } = useTheme();
  const { showSuccess, showError } = useNotification();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCustomerType, setSelectedCustomerType] = useState(null);
  const [customerCounts, setCustomerCounts] = useState({
    bw: 0,
  });

  // Bills/Entitlements data - server-side pagination
  const [bills, setBills] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [searchInput, setSearchInput] = useState(""); // instant typing
  const [searchTerm, setSearchTerm] = useState(""); // debounced, API trigger

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1); // reset pagination on new search
    }, 500); // 300–500ms is ideal

    return () => clearTimeout(handler);
  }, [searchInput]);

  // Customer type options
  const customerTypes = [
    {
      id: "bw",
      name: "Bandwidth",
      icon: Wifi,
      color: "blue",
      description: "Internet bandwidth subscribers",
    },
  ];

  // Fetch customer counts on mount
  useEffect(() => {
    fetchCustomerCounts();
  }, []);

  const fetchCustomerCounts = async () => {
    try {
      const limit = 1;
      const [bwRes] = await Promise.all([
        billService.getAllBills({ limit, offset: 0, customer_master_id__customer_type: "bw" }),
      ]);
      const getCount = (r) => (r && typeof r.count === "number" ? r.count : 0);
      setCustomerCounts({
        bw: getCount(bwRes),
      });
    } catch (err) {
      console.error("Error fetching bill counts:", err);
      setCustomerCounts({ bw: 0 });
    }
  };

  const fetchBills = React.useCallback(async () => {
    if (!selectedCustomerType) return;
    try {
      setLoading(true);
      setError(null);
      const limit = Math.min(Math.max(1, pageSize), 100);
      const offset = (currentPage - 1) * limit;
      const params = { limit, offset };
      if (searchTerm?.trim()) params.search = searchTerm.trim();
      params.customer_master_id__customer_type = selectedCustomerType;

      const response = await billService.getAllBills(params);
      const results = Array.isArray(response?.results)
        ? response.results
        : Array.isArray(response?.data)
          ? response.data
          : [];
      const count = response?.count ?? (Array.isArray(response) ? response.length : results.length);

      setBills(results);
      setTotalCount(count);
      setTotalPages(Math.ceil(count / limit) || 1);
    } catch (err) {
      console.error("Error fetching bills:", err);
      setError("Failed to load bill entries");
      showError("Failed to load bill entries");
      setBills([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [selectedCustomerType, currentPage, pageSize, searchTerm]);

  useEffect(() => {
    if (selectedCustomerType) fetchBills();
  }, [selectedCustomerType, fetchBills]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const handleCustomerTypeSelect = (typeId) => {
    // Navigate to DataEntry page with customer type filter
    navigate(`/data-entry?customerType=${typeId}`);
  };

  const handleBackToSelection = () => {
    setSelectedCustomerType(null);
    setBills([]);
    setSearchInput("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const handleNewBill = () => {
    // Note: Entitlement itself doesn't track selectedCustomerType anymore
    // since it redirects to DataEntry. The New Bill button in DataEntry
    // will handle passing the customerType parameter.
    navigate("/data-entry?new=true");
  };

  const handleEdit = (billId) => {
    navigate(`/data-entry?edit=${billId}`);
  };

  const handleView = (billId) => {
    // You can implement a view modal or navigate to a details page
    navigate(`/data-entry?view=${billId}`);
  };

  const handleDelete = async (billId) => {
    if (!window.confirm("Are you sure you want to delete this bill?")) {
      return;
    }

    try {
      await billService.deleteBill(billId);
      showSuccess("Bill deleted successfully");
      fetchBills();
    } catch (err) {
      console.error("Error deleting bill:", err);
      showError("Failed to delete bill");
    }
  };

  const getColorClasses = (color) => {
    const colors = {
      blue: {
        bg: isDark ? "bg-blue-900/20" : "bg-blue-50",
        border: "border-blue-500",
        text: "text-blue-600",
        hover: isDark ? "hover:bg-blue-900/30" : "hover:bg-blue-100",
      },
      green: {
        bg: isDark ? "bg-green-900/20" : "bg-green-50",
        border: "border-green-500",
        text: "text-green-600",
        hover: isDark ? "hover:bg-green-900/30" : "hover:bg-green-100",
      },
      purple: {
        bg: isDark ? "bg-indigo-900/20" : "bg-cyan-50",
        border: "border-cyan-500",
        text: "text-cyan-600",
        hover: isDark ? "hover:bg-indigo-900/30" : "hover:bg-cyan-100",
      },
    };
    return colors[color];
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className={`min-h-screen ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1
            className={`text-3xl font-bold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            <FileText className="inline-block mr-2 mb-1" size={32} />
            Entitlements
          </h1>
          <p className={`mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            {selectedCustomerType
              ? `Viewing ${
                  customerTypes.find((t) => t.id === selectedCustomerType)?.name
                } entitlements`
              : "Select subscriber type to open entitlements"}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mb-6 flex flex-wrap gap-4">
          {selectedCustomerType && (
            <button
              onClick={handleBackToSelection}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isDark
                  ? "bg-gray-700 text-white hover:bg-gray-600"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              ← Back to Selection
            </button>
          )}

          {hasPermission("entitlements:create") && (
            <button
              onClick={handleNewBill}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              New Bill
            </button>
          )}
        </div>

        {/* Main Content */}
        {loading && !selectedCustomerType ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-blue-400/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin"></div>
            </div>
          </div>
        ) : !selectedCustomerType ? (
          /* Customer Type Selection */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {customerTypes.map((type) => {
              const Icon = type.icon;
              const colors = getColorClasses(type.color);
              const count = customerCounts[type.id] || 0;

              return (
                <motion.div
                  key={type.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => handleCustomerTypeSelect(type.id)}
                  className={`${colors.bg} ${colors.border} border-2 rounded-xl p-6 cursor-pointer ${colors.hover} transition-all duration-200 transform hover:scale-105`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg ${colors.bg}`}>
                      <Icon className={colors.text} size={32} />
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full ${colors.bg} ${colors.text} font-bold text-lg`}
                    >
                      {count}
                    </div>
                  </div>
                  <h3
                    className={`text-xl font-bold mb-2 ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {type.name}
                  </h3>
                  <p
                    className={`text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {type.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <span
                      className={`text-sm ${
                        isDark ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {count} {count === 1 ? "bill entry" : "bill entries"}
                    </span>
                    <span className={`${colors.text} font-medium`}>
                      View Bills →
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* Bills List */
          <div>
            {/* Search Bar - ALWAYS mounted */}
            <div className="mb-6">
              <div className="relative">
                <Search
                  className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Search by bill number, customer, or company..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border ${
                    isDark
                      ? "bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                  } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
            </div>

            {error && (
              <ErrorAlert message={error} onClose={() => setError(null)} />
            )}

            {/* Only the table/content depends on loading */}
            {loading ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-4 border-blue-400/20"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin"></div>
                </div>
              </div>
            ) : bills.length === 0 ? (
              <div
                className={`text-center py-12 rounded-lg ${
                  isDark ? "bg-gray-800" : "bg-white"
                } border ${isDark ? "border-gray-700" : "border-gray-200"}`}
              >
                <FileText
                  className={`mx-auto mb-4 ${
                    isDark ? "text-gray-600" : "text-gray-400"
                  }`}
                  size={48}
                />
                <p
                  className={`text-lg ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  No bill entries found for this customer type
                </p>
              </div>
            ) : (
              <>
                {/* Bills Table */}
                <div
                  className={`overflow-x-auto rounded-lg border ${
                    isDark ? "border-gray-700" : "border-gray-200"
                  }`}
                >
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className={isDark ? "bg-gray-800" : "bg-gray-50"}>
                      <tr>
                        <th
                          className={`px-6 py-3 text-left text-xs font-medium ${
                            isDark ? "text-gray-300" : "text-gray-500"
                          } uppercase tracking-wider`}
                        >
                          Bill Number
                        </th>
                        <th
                          className={`px-6 py-3 text-left text-xs font-medium ${
                            isDark ? "text-gray-300" : "text-gray-500"
                          } uppercase tracking-wider`}
                        >
                          Customer / company
                        </th>
                        <th
                          className={`px-6 py-3 text-left text-xs font-medium ${
                            isDark ? "text-gray-300" : "text-gray-500"
                          } uppercase tracking-wider`}
                        >
                          Activation Date
                        </th>
                        <th
                          className={`px-6 py-3 text-left text-xs font-medium ${
                            isDark ? "text-gray-300" : "text-gray-500"
                          } uppercase tracking-wider`}
                        >
                          Total Bill
                        </th>
                        <th
                          className={`px-6 py-3 text-left text-xs font-medium ${
                            isDark ? "text-gray-300" : "text-gray-500"
                          } uppercase tracking-wider`}
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody
                      className={`${
                        isDark ? "bg-gray-900" : "bg-white"
                      } divide-y ${
                        isDark ? "divide-gray-700" : "divide-gray-200"
                      }`}
                    >
                      {bills.map((bill) => (
                        <tr
                          key={bill.id}
                          className={
                            isDark ? "hover:bg-gray-800" : "hover:bg-gray-50"
                          }
                        >
                          <td
                            className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                              isDark ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {bill.bill_number || "N/A"}
                          </td>
                          <td
                            className={`px-6 py-4 text-sm align-top ${
                              isDark ? "text-gray-300" : "text-gray-700"
                            }`}
                          >
                            {(() => {
                              const c =
                                bill.customer_master ||
                                (typeof bill.customer_master_id === "object"
                                  ? bill.customer_master_id
                                  : null);
                              const name =
                                c?.customer_name ||
                                (typeof bill.customer_master_id === "object"
                                  ? bill.customer_master_id?.customer_name
                                  : null) ||
                                "N/A";
                              const coRaw = c?.company_name;
                              const company =
                                coRaw != null &&
                                String(coRaw).trim() &&
                                String(coRaw).trim() !== "-"
                                  ? String(coRaw).trim()
                                  : "";
                              const showCo =
                                company && company !== name;
                              return (
                                <div
                                  className="max-w-[16rem]"
                                  title={
                                    showCo ? `${name} — ${company}` : name
                                  }
                                >
                                  <div className="font-medium text-gray-900 dark:text-gray-100">
                                    {name}
                                  </div>
                                  {showCo ? (
                                    <div
                                      className={`text-xs mt-0.5 ${
                                        isDark
                                          ? "text-gray-500"
                                          : "text-gray-500"
                                      }`}
                                    >
                                      {company}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })()}
                          </td>
                          <td
                            className={`px-6 py-4 whitespace-nowrap text-sm ${
                              isDark ? "text-gray-300" : "text-gray-700"
                            }`}
                          >
                            {formatDate(bill.activation_date)}
                          </td>
                          <td
                            className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                              isDark ? "text-green-400" : "text-green-600"
                            }`}
                          >
                            {formatCurrency(bill.total_bill)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleView(bill.id)}
                                className={`p-2 rounded-lg transition-colors ${
                                  isDark
                                    ? "hover:bg-gray-700 text-blue-400"
                                    : "hover:bg-gray-100 text-blue-600"
                                }`}
                                title="View"
                              >
                                <Eye size={18} />
                              </button>
                              {hasPermission("entitlements:update") && (
                                <button
                                  onClick={() => handleEdit(bill.id)}
                                  className={`p-2 rounded-lg transition-colors ${
                                    isDark
                                      ? "hover:bg-gray-700 text-green-400"
                                      : "hover:bg-gray-100 text-green-600"
                                  }`}
                                  title="Edit"
                                >
                                  <Edit2 size={18} />
                                </button>
                              )}
                              {hasPermission("entitlements:delete") && (
                                <button
                                  onClick={() => handleDelete(bill.id)}
                                  className={`p-2 rounded-lg transition-colors ${
                                    isDark
                                      ? "hover:bg-gray-700 text-red-400"
                                      : "hover:bg-gray-100 text-red-600"
                                  }`}
                                  title="Delete"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {(totalCount > 0 || bills.length > 0) && (
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
