import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorAlert from "../components/ErrorAlert";
import { billService } from "../services/billService";
import { BookOpen, RefreshCw, DollarSign, CreditCard, AlertCircle } from "lucide-react";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export default function Ledger() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isDark } = useTheme();
  const fromDate = searchParams.get("from_date") || "";
  const toDate = searchParams.get("to_date") || "";
  const [results, setResults] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    from_date: "",
    to_date: "",
    customer_name: "",
    company_name: "",
  });

  useEffect(() => {
    const from = searchParams.get("from_date") || "";
    const to = searchParams.get("to_date") || "";
    if (from || to) {
      setFilters((f) => ({ ...f, from_date: from, to_date: to }));
    }
  }, [searchParams]);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filters.from_date) params.from_date = filters.from_date;
      if (filters.to_date) params.to_date = filters.to_date;
      const data = await billService.getLedgerSummary(params);
      const list = Array.isArray(data?.results) ? data.results : [];
      setResults(list);
      setCount(data?.count ?? list.length);
    } catch (err) {
      console.error("Error fetching ledger:", err);
      setError(err.message || "Failed to load ledger summary");
      setResults([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [filters.from_date, filters.to_date]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const customerSearch = (filters.customer_name || "").trim().toLowerCase();
  const companySearch = (filters.company_name || "").trim().toLowerCase();
  const hasSearch = customerSearch || companySearch;
  const filteredResults = hasSearch
    ? results.filter((row) => {
        const matchCustomer = !customerSearch || (row.customer_name || "").toLowerCase().includes(customerSearch);
        const matchCompany = !companySearch || (row.company_name || "").toLowerCase().includes(companySearch);
        return matchCustomer && matchCompany;
      })
    : results;

  const totals = filteredResults.reduce(
    (acc, row) => ({
      total_bill_amount: acc.total_bill_amount + (Number(row.total_bill_amount) || 0),
      total_payment_received: acc.total_payment_received + (Number(row.total_payment_received) || 0),
      total_due_balance: acc.total_due_balance + (Number(row.total_due_balance) || 0),
    }),
    { total_bill_amount: 0, total_payment_received: 0, total_due_balance: 0 }
  );

  const cardBg = isDark ? "bg-gray-800/80 border-gray-700" : "bg-white border-gray-200";
  const cardText = isDark ? "text-gray-300" : "text-gray-600";
  const cardValue = isDark ? "text-white" : "text-gray-900";
  const tableHead = isDark ? "bg-gray-800 text-gray-300" : "bg-gray-50 text-gray-700";
  const tableRow = isDark ? "hover:bg-gray-700/50" : "hover:bg-gray-50";
  const tableBorder = isDark ? "divide-gray-700" : "divide-gray-200";
  const inputBg = isDark ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900";
  const labelClass = isDark ? "text-gray-400" : "text-gray-700";

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className={`text-2xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
          Ledger Summary
        </h1>
        <button
          onClick={fetchLedger}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className={`${cardBg} border rounded-lg p-4 mb-6 shadow-sm`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={`block text-sm font-medium ${labelClass} mb-1`}>Company name</label>
            <input
              type="text"
              placeholder="Search by company..."
              value={filters.company_name}
              onChange={(e) => setFilters((f) => ({ ...f, company_name: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${labelClass} mb-1`}>Customer name</label>
            <input
              type="text"
              placeholder="Search by customer name..."
              value={filters.customer_name}
              onChange={(e) => setFilters((f) => ({ ...f, customer_name: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${labelClass} mb-1`}>From date</label>
            <input
              type="date"
              value={filters.from_date}
              onChange={(e) => setFilters((f) => ({ ...f, from_date: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${labelClass} mb-1`}>To date</label>
            <input
              type="date"
              value={filters.to_date}
              onChange={(e) => setFilters((f) => ({ ...f, to_date: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
            />
          </div>
        </div>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className={`${cardBg} border rounded-xl p-5 shadow-sm`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-500">
                  <DollarSign size={22} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${cardText}`}>Total bill amount</p>
                  <p className={`text-xl font-bold ${cardValue}`}>{formatCurrency(totals.total_bill_amount)}</p>
                </div>
              </div>
            </div>
            <div className={`${cardBg} border rounded-xl p-5 shadow-sm`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20 text-green-500">
                  <CreditCard size={22} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${cardText}`}>Total payment received</p>
                  <p className={`text-xl font-bold ${cardValue}`}>{formatCurrency(totals.total_payment_received)}</p>
                </div>
              </div>
            </div>
            <div className={`${cardBg} border rounded-xl p-5 shadow-sm`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-500">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${cardText}`}>Total due balance</p>
                  <p className={`text-xl font-bold ${cardValue}`}>{formatCurrency(totals.total_due_balance)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className={`${cardBg} border rounded-lg shadow-sm overflow-hidden`}>
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <BookOpen size={20} className={isDark ? "text-gray-400" : "text-gray-600"} />
              <span className={`font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                {hasSearch ? `Customers (${filteredResults.length} of ${count})` : `All customers (${count})`}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className={tableHead}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Bill amount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Payment received</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Due balance</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${tableBorder} ${isDark ? "bg-gray-800/50" : "bg-white"}`}>
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan="5" className={`px-6 py-8 text-center ${cardText}`}>
                        {hasSearch
                          ? "No customers match your search"
                          : "No ledger data for the selected period"}
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((row) => {
                      const customerId = row.customer_id;
                      const goToSingleLedger = () => {
                        if (customerId == null) return;
                        const q = new URLSearchParams();
                        if (filters.from_date) q.set("from_date", filters.from_date);
                        if (filters.to_date) q.set("to_date", filters.to_date);
                        const query = q.toString();
                        navigate(query ? `/ledger/customer/${customerId}?${query}` : `/ledger/customer/${customerId}`);
                      };
                      return (
                        <tr
                          key={row.customer_id ?? row.customer_name}
                          onClick={goToSingleLedger}
                          className={`${tableRow} ${customerId != null ? "cursor-pointer" : ""}`}
                          role={customerId != null ? "button" : undefined}
                          tabIndex={customerId != null ? 0 : undefined}
                          onKeyDown={(e) => {
                            if (customerId != null && (e.key === "Enter" || e.key === " ")) {
                              e.preventDefault();
                              goToSingleLedger();
                            }
                          }}
                        >
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${cardText}`}>
                            {row.company_name ?? "—"}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${cardValue}`}>
                            {row.customer_name ?? "—"}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${cardValue}`}>
                            {formatCurrency(row.total_bill_amount)}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 dark:text-green-400`}>
                            {formatCurrency(row.total_payment_received)}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${Number(row.total_due_balance) > 0 ? "text-amber-600 dark:text-amber-400" : cardValue}`}>
                            {formatCurrency(row.total_due_balance)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
