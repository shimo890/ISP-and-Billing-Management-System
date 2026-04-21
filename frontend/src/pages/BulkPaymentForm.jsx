import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../services/api";
import { Search, CheckCircle2, Circle } from "lucide-react";

const CUSTOMER_TYPES = [
  { value: "bw", label: "Bandwidth" },
];

const PAYMENT_METHODS = [
  { value: "Cash", label: "Cash" },
  { value: "Bank Transfer", label: "Bank Transfer" },
  { value: "Cheque", label: "Cheque" },
  { value: "Bkash", label: "Bkash" },
  { value: "Nagad", label: "Nagad" },
];

const ALLOCATION_METHODS = [
  { value: "auto", label: "Auto (FIFO - Oldest First)" },
  { value: "manual", label: "Manual (Select Invoices)" },
];

export default function BulkPaymentForm() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [customerType, setCustomerType] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [entitlements, setEntitlements] = useState([]);
  const [selectedEntitlement, setSelectedEntitlement] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [allocationMethod, setAllocationMethod] = useState("auto");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [manualAllocations, setManualAllocations] = useState([]);

  // Loading states
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingEntitlements, setLoadingEntitlements] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Error and success states
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);

  // Fetch customers when customer type changes
  useEffect(() => {
    if (customerType) {
      fetchCustomersByType(customerType);
      resetDependentFields();
    } else {
      setCustomers([]);
      resetDependentFields();
    }
  }, [customerType]);

  // Fetch entitlements when customer changes
  useEffect(() => {
    if (selectedCustomer) {
      fetchEntitlementsByCustomer(selectedCustomer);
      setSelectedEntitlement("");
      setInvoices([]);
      setManualAllocations([]);
    } else {
      setEntitlements([]);
      setSelectedEntitlement("");
      setInvoices([]);
      setManualAllocations([]);
    }
  }, [selectedCustomer]);

  // Fetch invoices when entitlement changes
  useEffect(() => {
    if (selectedEntitlement) {
      fetchInvoicesByEntitlement(selectedEntitlement);
      setManualAllocations([]);
    } else {
      setInvoices([]);
      setManualAllocations([]);
    }
  }, [selectedEntitlement]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCustomerDropdown && !event.target.closest('.customer-dropdown-container')) {
        setShowCustomerDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCustomerDropdown]);

  const resetDependentFields = () => {
    setSelectedCustomer("");
    setCustomerSearchTerm("");
    setEntitlements([]);
    setSelectedEntitlement("");
    setInvoices([]);
    setSelectedInvoices([]);
    setManualAllocations([]);
  };

  // Filtered customers based on search term
  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm) return customers;
    const searchLower = customerSearchTerm.toLowerCase();
    return customers.filter(
      (customer) =>
        customer.customer_name?.toLowerCase().includes(searchLower) ||
        customer.customer_number?.toLowerCase().includes(searchLower) ||
        customer.email?.toLowerCase().includes(searchLower)
    );
  }, [customers, customerSearchTerm]);

  // Get selected customer object
  const selectedCustomerObj = useMemo(() => {
    return customers.find((c) => c.id === parseInt(selectedCustomer));
  }, [customers, selectedCustomer]);

  const fetchCustomersByType = async (type) => {
    setLoadingCustomers(true);
    setError(null);
    try {
      // Backend uses limit/offset (max 100 per request). Fetch all by paginating.
      const allCustomers = [];
      const limit = 100;
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const data = await api.get(`/customers/`, {
          params: { customer_type: type, is_active: true, limit, offset, minimal: 1 },
        });
        const results = data.results || data || [];
        const page = Array.isArray(results) ? results : [];
        allCustomers.push(...page);
        hasMore = page.length === limit;
        offset += limit;
      }
      setCustomers(allCustomers);
    } catch (err) {
      console.error("Error fetching customers:", err);
      setError(err.message || "Failed to load customers. Please try again.");
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchEntitlementsByCustomer = async (customerId) => {
    setLoadingEntitlements(true);
    setError(null);
    try {
      const allEntitlements = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;
      while (hasMore) {
        const data = await api.get(`/bills/entitlements/`, {
          params: { customer_master_id: customerId, limit, offset, minimal: 1 },
        });
        const page = data.results || data || [];
        const items = Array.isArray(page) ? page : [];
        allEntitlements.push(...items);
        hasMore = items.length === limit;
        offset += limit;
      }
      setEntitlements(allEntitlements);
    } catch (err) {
      console.error("Error fetching entitlements:", err);
      setError(err.message || "Failed to load entitlements. Please try again.");
      setEntitlements([]);
    } finally {
      setLoadingEntitlements(false);
    }
  };

  const fetchInvoicesByEntitlement = async (entitlementId) => {
    setLoadingInvoices(true);
    setError(null);
    try {
      // Fetch all invoices for this entitlement (paginated)
      const allInvoices = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;
      while (hasMore) {
        const data = await api.get(`/bills/invoices/`, {
          params: { entitlement_id: entitlementId, limit, offset },
        });
        const page = data.results || data || [];
        const items = Array.isArray(page) ? page : [];
        allInvoices.push(...items);
        hasMore = items.length === limit;
        offset += limit;
      }
      
      // Filter to show ONLY unpaid or partially paid invoices (exclude fully paid)
      const payableInvoices = allInvoices.filter(
        (invoice) =>
          invoice.status !== "paid" &&
          parseFloat(invoice.total_balance_due || 0) > 0
      );
      
      setInvoices(payableInvoices);
      setSelectedInvoices([]);
      setManualAllocations([]);
    } catch (err) {
      console.error("Error fetching invoices:", err);
      setError(err.message || "Failed to load invoices. Please try again.");
      setInvoices([]);
      setSelectedInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleAllocationMethodChange = (method) => {
    setAllocationMethod(method);
    setSelectedInvoices([]);
    setManualAllocations([]);
  };

  const handleInvoiceToggle = (invoiceId) => {
    setSelectedInvoices((prev) => {
      if (prev.includes(invoiceId)) {
        // Remove invoice
        const newSelected = prev.filter((id) => id !== invoiceId);
        setManualAllocations((allocs) =>
          allocs.filter((a) => a.invoice_id !== invoiceId)
        );
        return newSelected;
      } else {
        // Add invoice
        const invoice = invoices.find((inv) => inv.id === invoiceId);
        if (invoice) {
          setManualAllocations((allocs) => [
            ...allocs,
            {
              invoice_id: invoice.id,
              invoice_number: invoice.invoice_number,
              total_balance_due: parseFloat(invoice.total_balance_due || 0),
              amount: "",
            },
          ]);
        }
        return [...prev, invoiceId];
      }
    });
  };

  const handleManualAllocationChange = (invoiceId, amount) => {
    setManualAllocations((prev) =>
      prev.map((alloc) =>
        alloc.invoice_id === invoiceId ? { ...alloc, amount } : alloc
      )
    );
  };

  const handleSelectAllInvoices = () => {
    if (selectedInvoices.length === invoices.length) {
      // Deselect all
      setSelectedInvoices([]);
      setManualAllocations([]);
    } else {
      // Select all
      setSelectedInvoices(invoices.map((inv) => inv.id));
      setManualAllocations(
        invoices.map((inv) => ({
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          total_balance_due: parseFloat(inv.total_balance_due || 0),
          amount: "",
        }))
      );
    }
  };

  const getTotalDue = () => {
    return invoices.reduce(
      (sum, inv) => sum + parseFloat(inv.total_balance_due || 0),
      0
    );
  };

  const getTotalAllocated = () => {
    return manualAllocations.reduce(
      (sum, alloc) => sum + parseFloat(alloc.amount || 0),
      0
    );
  };

  const handleUseAllocatedTotal = () => {
    const total = getTotalAllocated();
    setPaymentAmount(total.toFixed(2));
  };

  const handlePayFullAmount = (invoiceId, balanceDue) => {
    handleManualAllocationChange(invoiceId, balanceDue.toString());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setPaymentResult(null);

    // Validation
    if (!selectedEntitlement || !paymentAmount || !paymentMethod) {
      setError(
        "Please select entitlement, enter payment amount, and select payment method."
      );
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (amount <= 0) {
      setError("Payment amount must be greater than 0.");
      return;
    }

    // Manual allocation validation
    if (allocationMethod === "manual") {
      if (selectedInvoices.length === 0) {
        setError(
          "Please select at least one invoice for manual allocation."
        );
        return;
      }

      const allocatedInvoices = manualAllocations.filter(
        (alloc) => alloc.amount && parseFloat(alloc.amount) > 0
      );

      if (allocatedInvoices.length === 0) {
        setError(
          "Please enter payment amounts for the selected invoices."
        );
        return;
      }

      // Check if all selected invoices have amounts
      const unallocatedCount = selectedInvoices.length - allocatedInvoices.length;
      if (unallocatedCount > 0) {
        setError(
          `Please enter payment amounts for all ${selectedInvoices.length} selected invoice(s). ${unallocatedCount} invoice(s) missing amounts.`
        );
        return;
      }

      const totalAllocated = getTotalAllocated();
      const paymentAmountFloat = parseFloat(paymentAmount);
      const difference = Math.abs(totalAllocated - paymentAmountFloat);
      
      // Allow small rounding differences up to 1 BDT
      if (difference > 1.00) {
        setError(
          `Total allocated amount (${totalAllocated.toFixed(
            2
          )} BDT) differs from payment amount (${paymentAmountFloat.toFixed(
            2
          )} BDT) by ${difference.toFixed(2)} BDT. Please adjust the allocations or click the "Use Allocated Total" button.`
        );
        return;
      }
      
      // Auto-adjust payment amount for very small differences (between 0.01 and 1.00)
      if (difference > 0.01 && difference <= 1.00) {
        setPaymentAmount(totalAllocated.toFixed(2));
      }

      // Check if any allocation exceeds invoice balance
      for (const alloc of allocatedInvoices) {
        const allocAmount = parseFloat(alloc.amount);
        if (allocAmount > alloc.total_balance_due) {
          setError(
            `Amount ${allocAmount.toFixed(2)} for invoice ${alloc.invoice_number} exceeds balance due ${alloc.total_balance_due.toFixed(2)}`
          );
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        entitlements_master_id: parseInt(selectedEntitlement),
        payment_amount: paymentAmount,
        allocation_method: allocationMethod,
        payment_method: paymentMethod,
        transaction_id: transactionId,
        remarks: remarks,
      };

      // Add allocations for manual method
      if (allocationMethod === "manual") {
        payload.allocations = manualAllocations
          .filter((alloc) => alloc.amount && parseFloat(alloc.amount) > 0)
          .map((alloc) => ({
            invoice_id: alloc.invoice_id,
            amount: alloc.amount,
          }));
      }

      console.log("Submitting bulk payment:", payload);

      const response = await api.post("/payments/bulk-pay/", payload);

      setSuccess(
        response.message || "Bulk payment processed successfully!"
      );
      setPaymentResult(response);

      // Reset form
      setTimeout(() => {
        setCustomerType("");
        setSelectedCustomer("");
        setCustomerSearchTerm("");
        setSelectedEntitlement("");
        setInvoices([]);
        setSelectedInvoices([]);
        setPaymentAmount("");
        setTransactionId("");
        setRemarks("");
        setManualAllocations([]);
        setPaymentResult(null);
      }, 5000);
    } catch (err) {
      console.error("Error processing bulk payment:", err);
      setError(err.message || "Failed to process payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = `w-full px-4 py-2 rounded-lg border ${
    isDark
      ? "bg-gray-700 border-gray-600 text-white focus:border-blue-500"
      : "bg-white border-gray-300 text-gray-900 focus:border-blue-500"
  } focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors`;

  const labelClass = `block text-sm font-medium mb-2 ${
    isDark ? "text-gray-300" : "text-gray-700"
  }`;

  return (
    <div
      className={`min-h-screen p-4 md:p-6 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1
            className={`text-2xl md:text-3xl font-bold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            💰 Bulk Payment Processing
          </h1>
          <p className={`mt-2 text-sm md:text-base ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Process payments for multiple invoices efficiently - Auto (FIFO) or Manual selection
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div
            className={`p-4 rounded-lg ${
              isDark
                ? "bg-blue-900/30 border border-blue-700"
                : "bg-blue-50 border border-blue-200"
            }`}
          >
            <h3
              className={`font-semibold mb-2 ${
                isDark ? "text-blue-300" : "text-blue-700"
              }`}
            >
              Auto Allocation (FIFO)
            </h3>
            <p
              className={`text-sm ${
                isDark ? "text-blue-200" : "text-blue-600"
              }`}
            >
              Automatically pays oldest invoices first. No need to select
              individual invoices.
            </p>
          </div>

          <div
            className={`p-4 rounded-lg ${
              isDark
                ? "bg-indigo-900/30 border border-cyan-700"
                : "bg-cyan-50 border border-cyan-200"
            }`}
          >
            <h3
              className={`font-semibold mb-2 ${
                isDark ? "text-cyan-300" : "text-cyan-700"
              }`}
            >
              Manual Allocation
            </h3>
            <p
              className={`text-sm ${
                isDark ? "text-cyan-200" : "text-cyan-600"
              }`}
            >
              Choose specific invoices and amounts. Total must equal payment
              amount.
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div
          className={`rounded-xl shadow-lg p-6 ${
            isDark
              ? "bg-gray-800 border border-gray-700"
              : "bg-white border border-gray-200"
          }`}
        >
          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-100 border border-red-400 text-red-700">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 mr-2 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Success Alert */}
          {success && (
            <div className="mb-6 p-4 rounded-lg bg-green-100 border border-green-400 text-green-700">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 mr-2 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{success}</span>
              </div>
            </div>
          )}

          {/* Payment Result */}
          {paymentResult && (
            <div
              className={`mb-6 p-6 rounded-lg ${
                isDark
                  ? "bg-green-900/30 border border-green-700"
                  : "bg-green-50 border border-green-300"
              }`}
            >
              <h3
                className={`text-lg font-bold mb-4 ${
                  isDark ? "text-green-300" : "text-green-800"
                }`}
              >
                Payment Summary
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p
                    className={`text-sm ${
                      isDark ? "text-green-400" : "text-green-600"
                    }`}
                  >
                    Total Due (Before)
                  </p>
                  <p
                    className={`text-xl font-bold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {paymentResult.total_due?.toLocaleString()} BDT
                  </p>
                </div>
                <div>
                  <p
                    className={`text-sm ${
                      isDark ? "text-green-400" : "text-green-600"
                    }`}
                  >
                    Total Received
                  </p>
                  <p
                    className={`text-xl font-bold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {paymentResult.total_received?.toLocaleString()} BDT
                  </p>
                </div>
                <div>
                  <p
                    className={`text-sm ${
                      isDark ? "text-green-400" : "text-green-600"
                    }`}
                  >
                    Remaining Balance
                  </p>
                  <p
                    className={`text-xl font-bold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {paymentResult.remaining_balance?.toLocaleString()} BDT
                  </p>
                </div>
                <div>
                  <p
                    className={`text-sm ${
                      isDark ? "text-green-400" : "text-green-600"
                    }`}
                  >
                    Invoices Paid
                  </p>
                  <p
                    className={`text-xl font-bold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {paymentResult.processed_invoices?.length || 0}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr
                      className={
                        isDark ? "bg-gray-700/50" : "bg-gray-100"
                      }
                    >
                      <th
                        className={`px-4 py-2 text-left text-xs font-semibold ${
                          isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Payment ID
                      </th>
                      <th
                        className={`px-4 py-2 text-left text-xs font-semibold ${
                          isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Invoice
                      </th>
                      <th
                        className={`px-4 py-2 text-right text-xs font-semibold ${
                          isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Paid Amount
                      </th>
                      <th
                        className={`px-4 py-2 text-right text-xs font-semibold ${
                          isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        New Balance
                      </th>
                      <th
                        className={`px-4 py-2 text-center text-xs font-semibold ${
                          isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentResult.processed_invoices?.map((inv, index) => (
                      <tr
                        key={index}
                        className={
                          isDark
                            ? "border-t border-gray-700"
                            : "border-t border-gray-200"
                        }
                      >
                        <td
                          className={`px-4 py-3 text-sm ${
                            isDark ? "text-gray-300" : "text-gray-900"
                          }`}
                        >
                          #{inv.payment_id}
                        </td>
                        <td
                          className={`px-4 py-3 text-sm ${
                            isDark ? "text-gray-300" : "text-gray-900"
                          }`}
                        >
                          {inv.invoice_number}
                        </td>
                        <td
                          className={`px-4 py-3 text-sm text-right font-semibold ${
                            isDark ? "text-green-400" : "text-green-600"
                          }`}
                        >
                          {inv.paid_amount?.toLocaleString()} BDT
                        </td>
                        <td
                          className={`px-4 py-3 text-sm text-right ${
                            isDark ? "text-gray-300" : "text-gray-900"
                          }`}
                        >
                          {inv.new_balance?.toLocaleString()} BDT
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              inv.status === "paid"
                                ? "bg-green-100 text-green-800"
                                : inv.status === "partial"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Type Select */}
            <div>
              <label className={labelClass}>
                Customer Type <span className="text-red-500">*</span>
              </label>
              <select
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value)}
                className={inputClass}
                required
              >
                <option value="">Select Customer Type</option>
                {CUSTOMER_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Select - Searchable */}
            <div className="relative">
              <label className={labelClass}>
                Customer <span className="text-red-500">*</span>
              </label>
              {loadingCustomers ? (
                <div className="flex items-center justify-center py-4">
                  <LoadingSpinner size="sm" />
                  <span
                    className={`ml-2 ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Loading customers...
                  </span>
                </div>
              ) : (
                <div className="customer-dropdown-container">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search
                        className={`h-5 w-5 ${
                          isDark ? "text-gray-400" : "text-gray-500"
                        }`}
                      />
                    </div>
                    <input
                      type="text"
                      value={
                        selectedCustomerObj
                          ? `${selectedCustomerObj.customer_name} (${
                              selectedCustomerObj.customer_number ||
                              selectedCustomerObj.email
                            })`
                          : customerSearchTerm
                      }
                      onChange={(e) => {
                        setCustomerSearchTerm(e.target.value);
                        setSelectedCustomer("");
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder={
                        !customerType
                          ? "Select customer type first"
                          : customers.length === 0
                          ? "No customers found"
                          : "Search customer by name, number, or email..."
                      }
                      disabled={!customerType || customers.length === 0}
                      className={`${inputClass} pl-10`}
                      required
                    />
                  </div>

                  {/* Customer Dropdown */}
                  {showCustomerDropdown &&
                    customerType &&
                    filteredCustomers.length > 0 && (
                      <div
                        className={`absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-lg border shadow-lg ${
                          isDark
                            ? "bg-gray-800 border-gray-600"
                            : "bg-white border-gray-300"
                        }`}
                      >
                        {filteredCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(customer.id.toString());
                              setCustomerSearchTerm("");
                              setShowCustomerDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-3 transition-colors ${
                              selectedCustomer === customer.id.toString()
                                ? isDark
                                  ? "bg-blue-900/50 text-blue-200"
                                  : "bg-blue-50 text-blue-700"
                                : isDark
                                ? "hover:bg-gray-700 text-gray-200"
                                : "hover:bg-gray-100 text-gray-900"
                            }`}
                          >
                            <div className="font-medium">
                              {customer.customer_name}
                            </div>
                            <div
                              className={`text-sm ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              {customer.customer_number || customer.email}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  
                  {selectedCustomerObj && (
                    <div
                      className={`mt-2 p-3 rounded-lg border ${
                        isDark
                          ? "bg-gray-700/50 border-gray-600"
                          : "bg-gray-50 border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p
                            className={`font-semibold ${
                              isDark ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {selectedCustomerObj.customer_name}
                          </p>
                          <p
                            className={`text-sm ${
                              isDark ? "text-gray-400" : "text-gray-600"
                            }`}
                          >
                            {selectedCustomerObj.customer_number} •{" "}
                            {selectedCustomerObj.email}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomer("");
                            setCustomerSearchTerm("");
                          }}
                          className={`text-sm px-2 py-1 rounded ${
                            isDark
                              ? "text-gray-400 hover:text-gray-200"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Entitlement Select */}
            <div>
              <label className={labelClass}>
                Entitlement / Bill <span className="text-red-500">*</span>
              </label>
              {loadingEntitlements ? (
                <div className="flex items-center justify-center py-4">
                  <LoadingSpinner size="sm" />
                  <span
                    className={`ml-2 ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Loading entitlements...
                  </span>
                </div>
              ) : (
                <select
                  value={selectedEntitlement}
                  onChange={(e) => setSelectedEntitlement(e.target.value)}
                  className={inputClass}
                  disabled={!selectedCustomer || entitlements.length === 0}
                  required
                >
                  <option value="">
                    {!selectedCustomer
                      ? "Select customer first"
                      : entitlements.length === 0
                      ? "No entitlements found"
                      : "Select Entitlement"}
                  </option>
                  {entitlements.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.bill_number} - Total: {ent.total_bill || 0} BDT
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Show Invoice Summary */}
            {loadingInvoices ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="sm" />
                <span
                  className={`ml-2 ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Loading invoices...
                </span>
              </div>
            ) : (
              invoices.length > 0 && (
                <div
                  className={`p-4 rounded-lg ${
                    isDark
                      ? "bg-gray-700/50 border border-gray-600"
                      : "bg-gray-50 border border-gray-300"
                  }`}
                >
                  <h4
                    className={`font-semibold mb-2 ${
                      isDark ? "text-gray-200" : "text-gray-800"
                    }`}
                  >
                    Unpaid Invoices Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p
                        className={`text-sm ${
                          isDark ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        Total Unpaid Invoices
                      </p>
                      <p
                        className={`text-2xl font-bold ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {invoices.length}
                      </p>
                    </div>
                    <div>
                      <p
                        className={`text-sm ${
                          isDark ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        Total Amount Due
                      </p>
                      <p
                        className={`text-2xl font-bold ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {getTotalDue().toLocaleString()} BDT
                      </p>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* Allocation Method */}
            {invoices.length > 0 && (
              <div>
                <label className={labelClass}>
                  Allocation Method <span className="text-red-500">*</span>
                </label>
                <select
                  value={allocationMethod}
                  onChange={(e) =>
                    handleAllocationMethodChange(e.target.value)
                  }
                  className={inputClass}
                  required
                >
                  {ALLOCATION_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
                <p
                  className={`mt-2 text-sm ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {allocationMethod === "auto"
                    ? "Payment will be automatically distributed to oldest invoices first (FIFO)."
                    : "You can specify exact amounts for each invoice. Total must equal payment amount."}
                </p>
              </div>
            )}

            {/* Manual Allocation - Invoice Selection with Checkboxes */}
            {allocationMethod === "manual" && invoices.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className={labelClass}>
                    Select Invoices to Pay{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllInvoices}
                    className={`text-sm px-3 py-1 rounded-lg transition-colors ${
                      isDark
                        ? "text-blue-400 hover:text-blue-300 hover:bg-gray-700"
                        : "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    }`}
                  >
                    {selectedInvoices.length === invoices.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>

                <div
                  className={`rounded-lg border ${
                    isDark
                      ? "border-gray-600 bg-gray-800/50"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {/* Invoice List with Checkboxes */}
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {invoices.map((invoice) => {
                      const isSelected = selectedInvoices.includes(invoice.id);
                      const allocation = manualAllocations.find(
                        (a) => a.invoice_id === invoice.id
                      );

                      return (
                        <div
                          key={invoice.id}
                          className={`p-4 transition-colors ${
                            isSelected
                              ? isDark
                                ? "bg-blue-900/20"
                                : "bg-blue-50"
                              : ""
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            {/* Checkbox */}
                            <button
                              type="button"
                              onClick={() => handleInvoiceToggle(invoice.id)}
                              className="flex-shrink-0 mt-1 focus:outline-none"
                            >
                              {isSelected ? (
                                <CheckCircle2
                                  className={`h-6 w-6 ${
                                    isDark
                                      ? "text-blue-400"
                                      : "text-blue-600"
                                  }`}
                                />
                              ) : (
                                <Circle
                                  className={`h-6 w-6 ${
                                    isDark
                                      ? "text-gray-600"
                                      : "text-gray-400"
                                  }`}
                                />
                              )}
                            </button>

                            {/* Invoice Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div className="flex-1">
                                  <p
                                    className={`font-semibold ${
                                      isDark ? "text-white" : "text-gray-900"
                                    }`}
                                  >
                                    {invoice.invoice_number}
                                  </p>
                                  <p
                                    className={`text-sm ${
                                      isDark
                                        ? "text-gray-400"
                                        : "text-gray-600"
                                    }`}
                                  >
                                    Issue Date:{" "}
                                    {new Date(
                                      invoice.issue_date
                                    ).toLocaleDateString()}
                                  </p>
                                </div>

                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p
                                      className={`text-sm ${
                                        isDark
                                          ? "text-gray-400"
                                          : "text-gray-600"
                                      }`}
                                    >
                                      Balance Due
                                    </p>
                                    <p
                                      className={`text-lg font-bold ${
                                        isDark
                                          ? "text-white"
                                          : "text-gray-900"
                                      }`}
                                    >
                                      {parseFloat(
                                        invoice.total_balance_due || 0
                                      ).toLocaleString()}{" "}
                                      BDT
                                    </p>
                                  </div>

                                  <span
                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      invoice.status === "partial"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : invoice.status === "unpaid"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {invoice.status}
                                  </span>
                                </div>
                              </div>

                              {/* Amount Input - Only show if selected */}
                              {isSelected && (
                                <div className="mt-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <label
                                      className={`text-sm font-medium ${
                                        isDark
                                          ? "text-gray-300"
                                          : "text-gray-700"
                                      }`}
                                    >
                                      Payment Amount (BDT)
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handlePayFullAmount(
                                          invoice.id,
                                          parseFloat(invoice.total_balance_due || 0)
                                        )
                                      }
                                      className={`text-xs px-2 py-1 rounded transition-colors ${
                                        isDark
                                          ? "bg-green-900/50 text-green-300 hover:bg-green-900"
                                          : "bg-green-100 text-green-700 hover:bg-green-200"
                                      }`}
                                    >
                                      Pay Full
                                    </button>
                                  </div>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={parseFloat(
                                      invoice.total_balance_due || 0
                                    )}
                                    value={allocation?.amount || ""}
                                    onChange={(e) =>
                                      handleManualAllocationChange(
                                        invoice.id,
                                        e.target.value
                                      )
                                    }
                                    placeholder={`Max: ${parseFloat(
                                      invoice.total_balance_due || 0
                                    ).toLocaleString()}`}
                                    className={`w-full sm:w-64 px-4 py-2 rounded-lg border ${
                                      isDark
                                        ? "bg-gray-700 border-gray-600 text-white"
                                        : "bg-white border-gray-300 text-gray-900"
                                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary Footer */}
                  {selectedInvoices.length > 0 && (
                    <div
                      className={`p-4 border-t ${
                        isDark
                          ? "border-gray-700 bg-gray-700/50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <p
                          className={`font-semibold ${
                            isDark ? "text-gray-200" : "text-gray-900"
                          }`}
                        >
                          {selectedInvoices.length} invoice(s) selected
                        </p>
                        <div className="text-right">
                          <p
                            className={`text-sm ${
                              isDark ? "text-gray-400" : "text-gray-600"
                            }`}
                          >
                            Total Allocated
                          </p>
                          <p
                            className={`text-xl font-bold ${
                              isDark ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {getTotalAllocated().toLocaleString()} BDT
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {selectedInvoices.length === 0 && (
                  <p
                    className={`mt-2 text-sm ${
                      isDark ? "text-yellow-400" : "text-yellow-600"
                    }`}
                  >
                    ⚠ Please select at least one invoice to proceed
                  </p>
                )}
              </div>
            )}

            {/* Payment Amount */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelClass + " mb-0"}>
                  Payment Amount (BDT) <span className="text-red-500">*</span>
                </label>
                {allocationMethod === "manual" && selectedInvoices.length > 0 && (
                  <button
                    type="button"
                    onClick={handleUseAllocatedTotal}
                    className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                      isDark
                        ? "bg-blue-900/50 text-blue-300 hover:bg-blue-900"
                        : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                    }`}
                  >
                    Use Allocated Total ({getTotalAllocated().toFixed(2)})
                  </button>
                )}
              </div>
              <input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className={inputClass}
                placeholder="Enter payment amount"
                required
              />
              {allocationMethod === "manual" && paymentAmount && selectedInvoices.length > 0 && (
                <div className="mt-2">
                  {Math.abs(getTotalAllocated() - parseFloat(paymentAmount || 0)) < 0.01 ? (
                    <p className="text-sm text-green-600 dark:text-green-400 flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Total allocated matches payment amount
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center">
                        <Circle className="h-4 w-4 mr-1" />
                        Difference: {Math.abs(getTotalAllocated() - parseFloat(paymentAmount || 0)).toFixed(2)} BDT
                      </p>
                      <button
                        type="button"
                        onClick={handleUseAllocatedTotal}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Click to auto-fix payment amount
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label className={labelClass}>
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={inputClass}
                required
              >
                <option value="">Select Payment Method</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Transaction ID */}
            <div>
              <label className={labelClass}>
                Transaction ID / Reference Number
              </label>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className={inputClass}
                placeholder="Enter transaction ID or reference number"
              />
              <p
                className={`mt-1 text-xs ${
                  isDark ? "text-gray-400" : "text-gray-500"
                }`}
              >
                Bank reference, cheque number, or payment gateway transaction ID
              </p>
            </div>

            {/* Remarks */}
            <div>
              <label className={labelClass}>Remarks</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className={inputClass}
                placeholder="Enter any additional remarks or notes"
                rows="3"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={
                  submitting ||
                  !selectedEntitlement ||
                  !paymentAmount ||
                  !paymentMethod ||
                  invoices.length === 0
                }
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                  submitting ||
                  !selectedEntitlement ||
                  !paymentAmount ||
                  !paymentMethod ||
                  invoices.length === 0
                    ? "bg-gray-400 cursor-not-allowed text-gray-200"
                    : "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:from-indigo-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                }`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Processing Payment...</span>
                  </span>
                ) : (
                  `Process Bulk Payment (${
                    allocationMethod === "auto" ? "Auto FIFO" : "Manual"
                  })`
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

