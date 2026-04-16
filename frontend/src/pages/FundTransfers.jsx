import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LoadingSpinner from "../components/LoadingSpinner";
import SearchableSelect from "../components/SearchableSelect";
import api from "../services/api";
import { useTheme } from "../context/ThemeContext";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" }).format(value ?? 0);
}

function FundTransfers() {
  const { isDark } = useTheme();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    customer_search: "",
    from_date: "",
    to_date: "",
  });
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.customer_search) params.append("customer_search", filters.customer_search);
      if (filters.from_date) params.append("from_date", filters.from_date);
      if (filters.to_date) params.append("to_date", filters.to_date);
      const qs = params.toString();
      const response = await api.get(qs ? `/payments/fund-transfers/?${qs}` : "/payments/fund-transfers/");
      setTransfers(Array.isArray(response) ? response : response?.results || []);
    } catch (err) {
      console.error("Error fetching fund transfers:", err);
      setError(err.response?.data?.error || err.message || "Failed to load fund transfers");
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Fund Transfers</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create Fund Transfer
        </button>
      </div>

      {/* Filters */}
      <div className={`p-4 rounded-lg shadow-sm border mb-6 ${isDark ? "bg-dark-700 border-dark-600" : "bg-white border-gray-200"}`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? "text-silver-300" : "text-gray-700"}`}>
              Customer Name / Company
            </label>
            <input
              type="text"
              value={filters.customer_search}
              onChange={(e) => handleFilterChange("customer_search", e.target.value)}
              className={`w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDark ? "bg-dark-600 border-dark-500 text-white" : "bg-white border-gray-300"
              }`}
              placeholder="Search by customer or company name"
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? "text-silver-300" : "text-gray-700"}`}>
              From Date
            </label>
            <input
              type="date"
              value={filters.from_date}
              onChange={(e) => handleFilterChange("from_date", e.target.value)}
              className={`w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDark ? "bg-dark-600 border-dark-500 text-white" : "bg-white border-gray-300"
              }`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? "text-silver-300" : "text-gray-700"}`}>
              To Date
            </label>
            <input
              type="date"
              value={filters.to_date}
              onChange={(e) => handleFilterChange("to_date", e.target.value)}
              className={`w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDark ? "bg-dark-600 border-dark-500 text-white" : "bg-white border-gray-300"
              }`}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">{error}</div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      )}

      {!loading && (
        <div className={`rounded-lg shadow-sm border overflow-hidden ${isDark ? "bg-dark-700 border-dark-600" : "bg-white border-gray-200"}`}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className={isDark ? "bg-dark-600" : "bg-gray-50"}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Ref #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Source / Target</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Remarks</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Source Payment</th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-gray-200 ${isDark ? "bg-dark-700" : "bg-white"}`}>
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                      No fund transfers found
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => {
                    const debitLine = t.lines?.find((l) => l.side === "debit");
                    const creditLine = t.lines?.find((l) => l.side === "credit");
                    const amount = debitLine ? Math.abs(debitLine.amount) : 0;
                    return (
                      <tr key={t.id} className={isDark ? "hover:bg-dark-600" : "hover:bg-gray-50"}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{t.reference_number || `#${t.id}`}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {t.transfer_date ? new Date(t.transfer_date).toLocaleDateString("en-GB") : "—"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <span className="text-red-600">{debitLine?.customer_name || "—"}</span>
                          <span className="mx-1">→</span>
                          <span className="text-green-600">{creditLine?.customer_name || "—"}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatCurrency(amount)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate">{t.remarks || "—"}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {t.source_payment ? (
                            <span title={`Invoice: ${t.source_payment.invoice_number}`}>
                              #{t.source_payment.payment_master_id} ({t.source_payment.invoice_number})
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <FundTransferCreateModal
            isDark={isDark}
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              fetchTransfers();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FundTransferCreateModal({ isDark, onClose, onSuccess }) {
  const [sourceOptions, setSourceOptions] = useState([]);
  const [targetOptions, setTargetOptions] = useState([]);
  const [loadingSourceOptions, setLoadingSourceOptions] = useState(false);
  const [loadingTargetOptions, setLoadingTargetOptions] = useState(false);
  const [sourceCustomerId, setSourceCustomerId] = useState("");
  const [targetCustomerId, setTargetCustomerId] = useState("");
  const [creditBalance, setCreditBalance] = useState(0);
  const [targetInvoices, setTargetInvoices] = useState([]);
  const [loadingTargetInvoices, setLoadingTargetInvoices] = useState(false);
  const [selectedTargetInvoiceIds, setSelectedTargetInvoiceIds] = useState([]);
  const [amount, setAmount] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);
  const [remarks, setRemarks] = useState("");
  const [addToCreditOnly, setAddToCreditOnly] = useState(false);
  const [loadingCredit, setLoadingCredit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);


  useEffect(() => {
    let mounted = true;
    const fetchSourceCustomers = async () => {
      setLoadingSourceOptions(true);
      try {
        const data = await api.get("/customers/credit-balances/");
        const list = Array.isArray(data) ? data : [];
        const options = list.map((c) => ({
          value: String(c.customer_id),
          label: `${[c.customer_name, c.company_name].filter(Boolean).join(" – ") || `Customer #${c.customer_id}`} · ${formatCurrency(c.credit_balance)}`,
        }));
        if (mounted) setSourceOptions([{ value: "", label: "Select customer" }, ...options]);
      } catch (e) {
        if (mounted) setError(e.message || "Failed to load source customers");
      } finally {
        if (mounted) setLoadingSourceOptions(false);
      }
    };
    fetchSourceCustomers();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!sourceCustomerId) {
      setCreditBalance(0);
      return;
    }
    let mounted = true;
    setLoadingCredit(true);
    setError(null);
    api
      .get(`/customers/${sourceCustomerId}/credit-balance/`)
      .then((data) => {
        if (mounted) setCreditBalance(data.credit_balance ?? 0);
      })
      .catch((e) => {
        if (mounted) {
          setCreditBalance(0);
          setError(e.response?.data?.error || e.message || "Failed to load credit balance");
        }
      })
      .finally(() => {
        if (mounted) setLoadingCredit(false);
      });
    return () => { mounted = false; };
  }, [sourceCustomerId]);

  useEffect(() => {
    if (!targetCustomerId || addToCreditOnly) {
      setTargetInvoices([]);
      setSelectedTargetInvoiceIds([]);
      return;
    }
    let mounted = true;
    setLoadingTargetInvoices(true);
    setError(null);
    api
      .get(`/bills/invoices/`, {
        params: { customer_id: targetCustomerId, limit: 100, ordering: "-issue_date" },
      })
      .then((data) => {
        const results = Array.isArray(data) ? data : data?.results || [];
        const unpaid = results.filter((inv) => (inv.total_balance_due || 0) > 0);
        if (mounted) setTargetInvoices(unpaid);
      })
      .catch((e) => {
        if (mounted) {
          setTargetInvoices([]);
          setError(e.response?.data?.error || e.message || "Failed to load target invoices");
        }
      })
      .finally(() => {
        if (mounted) setLoadingTargetInvoices(false);
      });
    return () => { mounted = false; };
  }, [targetCustomerId, addToCreditOnly]);

  const fetchTargetCustomers = async (term) => {
    setLoadingTargetOptions(true);
    try {
      const params = new URLSearchParams();
      params.append("minimal", "1");
      params.append("limit", "20");
      if (term) params.append("search", term);
      const data = await api.get(`/customers/?${params.toString()}`);
      const list = Array.isArray(data) ? data : data?.results || [];
      const options = list.map((c) => ({
        value: String(c.id),
        label: [c.customer_name, c.company_name].filter(Boolean).join(" – ") || `Customer #${c.id}`,
      }));
      setTargetOptions([{ value: "", label: "Select customer" }, ...options]);
    } catch (e) {
      setTargetOptions([{ value: "", label: "Select customer" }]);
      setError(e.message || "Failed to load target customers");
    } finally {
      setLoadingTargetOptions(false);
    }
  };

  const handleTargetSearch = (term) => {
    clearTimeout(handleTargetSearch._timer);
    handleTargetSearch._timer = setTimeout(() => {
      fetchTargetCustomers(term);
    }, 250);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const amt = parseFloat(amount);
    if (!sourceCustomerId || !targetCustomerId || isNaN(amt) || amt <= 0) {
      setError("Please select source customer, target customer, and enter a valid amount.");
      return;
    }
    if (sourceCustomerId === targetCustomerId) {
      setError("Source and target customers must be different.");
      return;
    }
    if (amt > creditBalance) {
      setError(`Amount cannot exceed available credit balance (${formatCurrency(creditBalance)}).`);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        transfer_date: transferDate,
        remarks: remarks || "",
        source_customer_id: parseInt(sourceCustomerId),
        target_customer_id: parseInt(targetCustomerId),
        amount: amt,
        apply_to_target_invoice: !addToCreditOnly && selectedTargetInvoiceIds.length > 0,
        target_invoice_ids: selectedTargetInvoiceIds,
      };
      await api.post("/payments/fund-transfers/", payload);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to create fund transfer");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl shadow-2xl border pointer-events-auto my-auto ${
            isDark ? "bg-dark-700 border-dark-600" : "bg-white border-gray-200"
          }`}
        >
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold truncate min-w-0">Create Fund Transfer</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={`flex-shrink-0 p-2 rounded-lg transition-colors ${isDark ? "hover:bg-dark-600" : "hover:bg-gray-100"}`}
            >
              ✕
            </button>
          </div>

          {error && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              isDark ? "bg-red-900/30 border border-red-700 text-red-300" : "bg-red-50 border border-red-200 text-red-700"
            }`}>{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? "text-silver-300" : "text-gray-700"}`}>
                Source Customer *
              </label>
              <SearchableSelect
                options={sourceOptions}
                value={sourceCustomerId}
                onChange={setSourceCustomerId}
                placeholder="Select source customer"
                loading={loadingSourceOptions}
                isDark={isDark}
              />
            </div>

            {sourceCustomerId && (
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? "text-silver-300" : "text-gray-700"}`}>
                  Available Credit
                </label>
                <div className="flex items-center gap-2">
                  {loadingCredit ? (
                    <span className="text-sm text-gray-500">Loading...</span>
                  ) : (
                    <span className="text-lg font-semibold text-green-600">{formatCurrency(creditBalance)}</span>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? "text-silver-300" : "text-gray-700"}`}>
                Target Customer *
              </label>
              <SearchableSelect
                options={targetOptions}
                value={targetCustomerId}
                onChange={setTargetCustomerId}
                placeholder="Select target customer"
                loading={loadingTargetOptions}
                isDark={isDark}
                onSearchChange={handleTargetSearch}
              />
            </div>

            {!addToCreditOnly && targetCustomerId && (
              <div className={`rounded-lg border p-3 text-sm ${
                isDark ? "bg-dark-600 border-dark-500 text-silver-300" : "bg-gray-50 border-gray-200 text-gray-700"
              }`}>
                <div className="font-medium mb-2">Target unpaid invoices (auto-apply)</div>
                {loadingTargetInvoices ? (
                  <div className="text-xs text-gray-500">Loading invoices...</div>
                ) : targetInvoices.length === 0 ? (
                  <div className="text-xs text-gray-500">No unpaid invoices found. Credit will remain as balance.</div>
                ) : (
                  <>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {targetInvoices.map((inv) => {
                        const checked = selectedTargetInvoiceIds.includes(inv.id);
                        return (
                          <label key={inv.id} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedTargetInvoiceIds((prev) =>
                                  checked ? prev.filter((id) => id !== inv.id) : [...prev, inv.id]
                                );
                              }}
                              className={`rounded border ${isDark ? "bg-dark-700 border-dark-500" : "border-gray-300"} text-blue-600 focus:ring-blue-500`}
                            />
                            <span>
                              #{inv.invoice_number || inv.id} · {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString("en-GB") : "—"} · Due {formatCurrency(inv.total_balance_due || 0)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="text-xs text-gray-500">
                      Select one or more invoices. If none selected, amount goes to credit balance only.
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="addToCreditOnly"
                checked={addToCreditOnly}
                onChange={(e) => setAddToCreditOnly(e.target.checked)}
                className={`mt-1 rounded border ${isDark ? "bg-dark-600 border-dark-500" : "border-gray-300"} text-blue-600 focus:ring-blue-500`}
              />
              <label htmlFor="addToCreditOnly" className={`text-sm ${isDark ? "text-silver-300" : "text-gray-700"}`}>
                Add to credit balance only — do not apply to target&apos;s unpaid invoices (target will see the amount in Credit Balances)
              </label>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? "text-silver-300" : "text-gray-700"}`}>
                Amount *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? "bg-dark-600 border-dark-500 text-white" : "bg-white border-gray-300"
                }`}
                placeholder="Enter amount"
              />
              {creditBalance > 0 && (
                <p className="mt-1 text-xs text-gray-500">Max: {formatCurrency(creditBalance)}</p>
              )}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? "text-silver-300" : "text-gray-700"}`}>
                Transfer Date *
              </label>
              <input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? "bg-dark-600 border-dark-500 text-white" : "bg-white border-gray-300"
                }`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? "text-silver-300" : "text-gray-700"}`}>
                Remarks
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                className={`w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? "bg-dark-600 border-dark-500 text-white" : "bg-white border-gray-300"
                }`}
                placeholder="e.g. Owner Adjustment Transfer – Raju"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isDark ? "bg-dark-600 hover:bg-dark-500 text-silver-300" : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create Transfer"}
              </button>
            </div>
          </form>
        </div>
        </motion.div>
      </div>
    </>
  );
}

export default FundTransfers;
