import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorAlert from "../components/ErrorAlert";
import SearchableSelect from "../components/SearchableSelect";
import Pagination from "../components/Pagination";
import PageLayout from "../components/PageLayout";
import api from "../services/api";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" }).format(value);
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    payment_method: "",
    status: "",
    start_date: "",
    end_date: "",
    search: "",
    company_name: ""
  });
  const navigate = useNavigate();

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const limit = Math.min(Math.max(1, pageSize), 100);
      const offset = (currentPage - 1) * limit;
      const queryParams = new URLSearchParams();
      queryParams.append("limit", limit);
      queryParams.append("offset", offset);
      queryParams.append("ordering", "-created_at");
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const response = await api.get(`/payments/?${queryParams.toString()}`);
      const results = Array.isArray(response?.results)
        ? response.results
        : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
            ? response
            : [];
      const count = response?.count ?? (Array.isArray(response) ? response.length : results.length);

      setPayments(results);
      setTotalCount(count);
      setTotalPages(Math.ceil(count / limit) || 1);
    } catch (err) {
      console.error("Error fetching payments:", err);
      setError(err.response?.data?.detail || err.response?.data?.message || "Failed to load payments");
      setPayments([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, filters]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      completed: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      failed: "bg-red-100 text-red-800",
    };
    return statusColors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <PageLayout
      title="Payments"
      subtitle="Track received payments and allocations"
      actions={
        <button
          onClick={() => navigate("/payment")}
          className="px-4 py-2 bg-gradient-to-r from-gold-600 to-cyan-600 text-white rounded-lg hover:from-gold-700 hover:to-cyan-700 transition-colors"
        >
          Create Payment
        </button>
      }
    >

      {/* Filters */}
      <div className="bg-white dark:bg-dark-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-dark-700 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-dark-700 rounded-md bg-white dark:bg-dark-900 focus:outline-none focus:ring-2 focus:ring-gold-500"
              placeholder="Customer Name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input
              type="text"
              value={filters.company_name}
              onChange={(e) => handleFilterChange("company_name", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-dark-700 rounded-md bg-white dark:bg-dark-900 focus:outline-none focus:ring-2 focus:ring-gold-500"
              placeholder="Company Name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <SearchableSelect
              options={[
                { value: "", label: "All Methods" },
                { value: "Cash", label: "Cash" },
                { value: "Bank Transfer", label: "Bank Transfer" },
                { value: "Credit Card", label: "Credit Card" },
                { value: "Cheque", label: "Cheque" }
              ]}
              value={filters.payment_method}
              onChange={(value) => handleFilterChange('payment_method', value)}
              placeholder="Select payment method"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <SearchableSelect
              options={[
                { value: "", label: "All Status" },
                { value: "completed", label: "Completed" },
                { value: "pending", label: "Pending" },
                { value: "failed", label: "Failed" }
              ]}
              value={filters.status}
              onChange={(value) => handleFilterChange('status', value)}
              placeholder="Select status"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange("start_date", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-dark-700 rounded-md bg-white dark:bg-dark-900 focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange("end_date", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-dark-700 rounded-md bg-white dark:bg-dark-900 focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
          </div>
        </div>
      </div>

    {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

    {loading && (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    )}

    {/* Payments Table */}
    {!loading && (
      <>
        <div className="bg-white dark:bg-dark-900 rounded-xl shadow-sm border border-slate-200 dark:border-dark-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-50 dark:bg-dark-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-silver-300 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Remarks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-dark-900 divide-y divide-slate-200 dark:divide-dark-700">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="px-6 py-4 text-center text-slate-500 dark:text-silver-400">
                      No payments found
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => {
                    const goToPaymentView = () => navigate("/payment-view", { state: { payment } });
                    return (
                    <tr
                      key={payment.id}
                      onClick={goToPaymentView}
                      className="hover:bg-slate-50 dark:hover:bg-dark-800 cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          goToPaymentView();
                        }
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                        {payment.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(payment.payment_date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.customer_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.invoice_number || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.payment_method}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.details && payment.details.length > 0 ? payment.details[0].transaction_id || 'N/A' : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(payment.total_paid || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.remarks || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(payment.status)}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/payment-edit/${payment.id}`, { state: { payment } })}
                          className="text-gold-600 hover:text-gold-700 mr-2"
                          title="Edit"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {(totalCount > 0 || payments.length > 0) && (
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
    </PageLayout>
  );
}