import React, { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorAlert from "../components/ErrorAlert";
import { billService } from "../services/billService";
import { ArrowLeft, User, Building2, Calendar, BookOpen, DollarSign, CreditCard, AlertCircle } from "lucide-react";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export default function SingleLedger() {
  const { customerId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const fromDate = searchParams.get("from_date") || "";
  const toDate = searchParams.get("to_date") || "";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFilters, setDateFilters] = useState({ from_date: fromDate, to_date: toDate });

  const fetchLedger = useCallback(async () => {
    if (!customerId) {
      setLoading(false);
      setError("No customer selected");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (dateFilters.from_date) params.from_date = dateFilters.from_date;
      if (dateFilters.to_date) params.to_date = dateFilters.to_date;
      const res = await billService.getLedgerCustomer(customerId, params);
      // API interceptor returns response.data, so res is the ledger object
      setData(res);
    } catch (err) {
      console.error("Error fetching customer ledger:", err);
      setError(err.response?.data?.detail || err.message || "Failed to load ledger");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [customerId, dateFilters.from_date, dateFilters.to_date]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const goBack = () => {
    const q = new URLSearchParams();
    if (dateFilters.from_date) q.set("from_date", dateFilters.from_date);
    if (dateFilters.to_date) q.set("to_date", dateFilters.to_date);
    const query = q.toString();
    navigate(query ? `/ledger?${query}` : "/ledger");
  };

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
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Back to Ledger"
          >
            <ArrowLeft size={20} className={cardText} />
          </button>
          <h1 className={`text-2xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
            Customer Ledger
          </h1>
        </div>
        {!loading && data && (
          <button
            onClick={fetchLedger}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Refresh
          </button>
        )}
      </div>

      {/* Date filters - same period as summary */}
      <div className={`${cardBg} border rounded-lg p-4 mb-6 shadow-sm`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
          <div>
            <label className={`block text-sm font-medium ${labelClass} mb-1`}>From date</label>
            <input
              type="date"
              value={dateFilters.from_date}
              onChange={(e) => setDateFilters((f) => ({ ...f, from_date: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${labelClass} mb-1`}>To date</label>
            <input
              type="date"
              value={dateFilters.to_date}
              onChange={(e) => setDateFilters((f) => ({ ...f, to_date: e.target.value }))}
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

      {!loading && data && (
        <>
          {/* Customer info & period */}
          <div className={`${cardBg} border rounded-lg p-5 mb-6 shadow-sm`}>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <User size={20} className={cardText} />
                <span className={cardText}>Customer:</span>
                <span className={`font-medium ${cardValue}`}>{data.customer_name ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 size={20} className={cardText} />
                <span className={cardText}>Company:</span>
                <span className={cardValue}>{data.company_name ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={20} className={cardText} />
                <span className={cardText}>Period:</span>
                <span className={cardValue}>
                  {data.from_date && data.to_date
                    ? `${data.from_date} to ${data.to_date}`
                    : "All time"}
                </span>
              </div>
            </div>
          </div>

          {/* Opening balance + API summary totals + Closing balance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className={`${cardBg} border rounded-xl p-5 shadow-sm`}>
              <p className={`text-sm font-medium ${cardText} mb-1`}>Opening balance</p>
              <p className={`text-xl font-bold ${cardValue}`}>
                {formatCurrency(data.opening_balance)}
              </p>
            </div>
            <div className={`${cardBg} border rounded-xl p-5 shadow-sm`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-500">
                  <DollarSign size={22} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${cardText}`}>Total bill amount</p>
                  <p className={`text-xl font-bold ${cardValue}`}>
                    {formatCurrency(data.total_bill_amount ?? 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className={`${cardBg} border rounded-xl p-5 shadow-sm`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20 text-green-500">
                  <CreditCard size={22} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${cardText}`}>Total received</p>
                  <p className={`text-xl font-bold ${cardValue}`}>
                    {formatCurrency(data.total_received_amount ?? 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className={`${cardBg} border rounded-xl p-5 shadow-sm`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-500">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${cardText}`}>Total due</p>
                  <p className={`text-xl font-bold ${Number(data.total_invoice_due_amount ?? data.closing_balance) > 0 ? "text-amber-600 dark:text-amber-400" : cardValue}`}>
                    {formatCurrency(data.total_invoice_due_amount ?? data.closing_balance ?? 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className={`${cardBg} border rounded-xl p-5 shadow-sm`}>
              <p className={`text-sm font-medium ${cardText} mb-1`}>Closing balance</p>
              <p className={`text-xl font-bold ${Number(data.closing_balance) > 0 ? "text-amber-600 dark:text-amber-400" : cardValue}`}>
                {formatCurrency(data.closing_balance)}
              </p>
            </div>
          </div>

          {/* Ledger entries table - Debit / Credit / Running balance */}
          <div className={`${cardBg} border rounded-lg shadow-sm overflow-hidden`}>
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <BookOpen size={20} className={isDark ? "text-gray-400" : "text-gray-600"} />
              <span className={`font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Ledger entries
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className={tableHead}>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Particulars</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">#</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider">Debit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider">Credit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider">Balance</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${tableBorder} ${isDark ? "bg-gray-800/50" : "bg-white"}`}>
                  {(!data.ledger_entries || data.ledger_entries.length === 0) ? (
                    <tr>
                      <td colSpan="6" className={`px-6 py-8 text-center ${cardText}`}>
                        No ledger entries for the selected period
                      </td>
                    </tr>
                  ) : (
                    [...data.ledger_entries]
                      .sort((a, b) => {
                        const dateA = (a.type === "invoice" ? a.invoice_date : a.payment_date) || "";
                        const dateB = (b.type === "invoice" ? b.invoice_date : b.payment_date) || "";
                        return dateA.localeCompare(dateB);
                      })
                      .map((entry, idx) => {
                      const isInvoice = entry.type === "invoice";
                      const date = isInvoice ? entry.invoice_date : entry.payment_date;
                      const particulars = isInvoice
                        ? `Bandwidth Sales`
                        : [entry.payment_method, entry.payment_remarks].filter(Boolean).join(" — ") || "Payment";
                      const debit = isInvoice ? (Number(entry.invoice_amount) || 0) : 0;
                      const credit = isInvoice ? 0 : (Number(entry.payment_received_amount) || 0);
                      return (
                        <tr key={`${entry.invoice_id}-${entry.type}-${date}-${idx}`} className={tableRow}>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm ${cardText}`}>
                            {date ?? "—"}
                          </td>
                          <td className={`px-4 py-3 text-sm ${cardValue}`}>
                            {particulars}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm ${cardText}`}>
                            {entry.invoice_number ?? "—"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">
                            {debit !== 0 ? formatCurrency(debit) : "—"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-600 dark:text-green-400">
                            {credit !== 0 ? formatCurrency(credit) : "—"}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${Number(entry.running_balance) > 0 ? "text-amber-600 dark:text-amber-400" : cardValue}`}>
                            {formatCurrency(entry.running_balance)}
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
