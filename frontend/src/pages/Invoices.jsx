import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";
import SearchableSelect from "../components/SearchableSelect";
import Pagination from "../components/Pagination";
import PageLayout from "../components/PageLayout";
import api from "../services/api";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" }).format(value);
}

const NAME_SEARCH_DEBOUNCE_MS = 300;

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    customer_id: "",
    customer_type: "",
    status: "",
    start_date: "",
    end_date: "",
    search: "",
    customer_name: "",
    company_name: "",
  });
  const navigate = useNavigate();

  const displayInvoices = invoices;
  const displayTotalCount = totalCount;
  const displayTotalPages = totalPages;

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const limit = Math.min(Math.max(1, pageSize), 100);
      const offset = (currentPage - 1) * limit;
      const queryParams = new URLSearchParams();
      queryParams.append("limit", limit);
      queryParams.append("offset", offset);
      const apiFilterKeys = ["customer_id", "customer_type", "status", "start_date", "end_date", "search", "customer_name", "company_name"];
      apiFilterKeys.forEach((key) => {
        const value = filters[key];
        if (value) queryParams.append(key, value);
      });

      const response = await api.get(`/bills/invoices/?${queryParams.toString()}`);
      const results = Array.isArray(response?.results)
        ? response.results
        : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
            ? response
            : [];
      const count = response?.count ?? (Array.isArray(response) ? response.length : results.length);

      setInvoices(results);
      setTotalCount(count);
      setTotalPages(Math.ceil(count / limit) || 1);
    } catch (err) {
      console.error("Error fetching invoices:", err);
      setError(err.response?.data?.detail || err.response?.data?.message || "Failed to load invoices");
      setInvoices([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, filters]);

  useEffect(() => {
    const debounceMs = (filters.customer_name || "").trim() || (filters.company_name || "").trim() ? NAME_SEARCH_DEBOUNCE_MS : 0;
    const timeoutId = setTimeout(() => {
      fetchInvoices();
    }, debounceMs);
    return () => clearTimeout(timeoutId);
  }, [currentPage, pageSize, filters.customer_id, filters.customer_type, filters.status, filters.start_date, filters.end_date, filters.search, filters.customer_name, filters.company_name, fetchInvoices]);
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
      draft: "bg-gray-100 text-gray-800",
      unpaid: "bg-red-100 text-red-800",
      partial: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800"
    };
    return statusColors[status] || "bg-gray-100 text-gray-800";
  };

  const getCustomerTypeDisplay = (type) => {
    const typeLabels = {
      bw: "Bandwidth",
    };
    return typeLabels[type] || type || "N/A";
  };

return (
  <PageLayout
    title="Invoices"
    subtitle="Manage and review generated invoices"
    actions={
      <button
        onClick={() => navigate('/invoice')}
        className="px-4 py-2 bg-gradient-to-r from-gold-600 to-cyan-600 text-white rounded-lg hover:from-gold-700 hover:to-cyan-700 transition-colors"
      >
        Create Invoice
      </button>
    }
  >

    {/* Filters */}
    <div className="bg-white dark:bg-dark-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-dark-700 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company name</label>
          <input
            type="text"
            value={filters.company_name}
            onChange={(e) => handleFilterChange("company_name", e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-dark-700 rounded-md bg-white dark:bg-dark-900 focus:outline-none focus:ring-2 focus:ring-gold-500"
            placeholder="Search by company..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer name</label>
          <input
            type="text"
            value={filters.customer_name}
            onChange={(e) => handleFilterChange("customer_name", e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-dark-700 rounded-md bg-white dark:bg-dark-900 focus:outline-none focus:ring-2 focus:ring-gold-500"
            placeholder="Search by customer name..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer Type</label>
          <SearchableSelect
            options={[
              { value: "", label: "All Types" },
              { value: "bw", label: "Bandwidth" },
            ]}
            value={filters.customer_type}
            onChange={(value) => handleFilterChange('customer_type', value)}
            placeholder="Select customer type"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <SearchableSelect
            options={[
              { value: "", label: "All Status" },
              { value: "draft", label: "Draft" },
              { value: "unpaid", label: "Unpaid" },
              { value: "partial", label: "Partial" },
              { value: "paid", label: "Paid" }
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
            onChange={(e) => handleFilterChange('start_date', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-dark-700 rounded-md bg-white dark:bg-dark-900 focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => handleFilterChange('end_date', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-dark-700 rounded-md bg-white dark:bg-dark-900 focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
        </div>

      </div>
    </div>

    {/* Error Message */}
    {error && (
      <div className="bg-red-100 dark:bg-red-950/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-6">
        {error}
      </div>
    )}

    {/* Loading */}
    {loading && (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    )}

    {/* Invoices Table */}
    {!loading && (
      <>
      <div className="bg-white dark:bg-dark-900 rounded-xl shadow-sm border border-slate-200 dark:border-dark-700 overflow-hidden">
        {displayTotalCount > 0 && (
          <div className="px-4 py-2 border-b border-slate-200 dark:border-dark-700 text-sm text-slate-600 dark:text-silver-300">
            {displayTotalCount} invoice{displayTotalCount !== 1 ? "s" : ""} found
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-50 dark:bg-dark-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-silver-300 uppercase tracking-wider">
                  Invoice Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issue Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paid Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice Due
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Due
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
              {displayInvoices.length === 0 ? (
                <tr>
                  <td colSpan="12" className="px-6 py-4 text-center text-slate-500 dark:text-silver-400">
                    No invoices found
                  </td>
                </tr>
              ) : (
                displayInvoices.map((invoice) => {
                  const goToInvoiceView = () => navigate("/invoice-view", { state: { invoice } });
                  return (
                  <tr
                    key={invoice.id}
                    onClick={goToInvoiceView}
                    className="hover:bg-slate-50 dark:hover:bg-dark-800 cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        goToInvoiceView();
                      }
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                      {invoice.invoice_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-silver-200">
                      {invoice.company_name || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invoice.customer_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getCustomerTypeDisplay(invoice.customer_type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(invoice.issue_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(invoice.total_bill_amount || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(invoice.total_paid_amount || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(invoice.total_balance_due || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">
                      {formatCurrency(invoice.customer_total_due ?? invoice.total_balance_due ?? 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400" onClick={(e) => e.stopPropagation()}>
                      —
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
      {(displayTotalCount > 0 || displayInvoices.length > 0) && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={displayTotalPages || 1}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            totalCount={displayTotalCount}
          />
        </div>
      )}
      </>
    )}
  </PageLayout>
);
}
