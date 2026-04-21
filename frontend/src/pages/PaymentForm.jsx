import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import SearchableSelect from "../components/SearchableSelect";
import api from "../services/api";

const CUSTOMER_TYPES = [
  { value: "bw", label: "Bandwidth" },
];

const PAYMENT_METHODS = [
  { value: "Cash", label: "Cash" },
  { value: "Bkash", label: "Bkash" },
  { value: "Bank Transfer", label: "Bank Transfer" },
  { value: "Commission (Adjustment)", label: "Commission (Adjustment)" },
];

/** Format date as "January 2025" for clear month display */
function formatInvoiceMonth(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}


export default function PaymentForm() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerType, setCustomerType] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [adjustmentTransferEnabled, setAdjustmentTransferEnabled] = useState(false);
  const [adjustmentTransferAmount, setAdjustmentTransferAmount] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [remarks, setRemarks] = useState("");

  // Loading states
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Error state
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Calculations
  const selectedInvoiceObjects = invoices.filter((invoice) =>
    selectedInvoices.includes(invoice.id)
  );
  const totalSelectedAmount = selectedInvoiceObjects.reduce(
    (sum, invoice) =>
      sum + (invoice.total_balance_due || invoice.total_bill_amount || 0),
    0
  );
  const amt = parseFloat(amount) || 0;
  const adjAmt = adjustmentTransferEnabled ? (parseFloat(adjustmentTransferAmount) || 0) : 0;
  const invoicePaymentAmount = amt - adjAmt;
  const balance = amount ? totalSelectedAmount - invoicePaymentAmount : 0;


  // Fetch customers when customer type changes
  useEffect(() => {
    if (customerType) {
      fetchCustomersByType(customerType);
      // Reset dependent fields
      setSelectedCustomer("");
      setInvoices([]);
      setSelectedInvoices([]);
    } else {
      setCustomers([]);
      setSelectedCustomer("");
      setInvoices([]);
      setSelectedInvoices([]);
    }
  }, [customerType]);

  // Fetch unpaid invoices when customer changes
  useEffect(() => {
    if (selectedCustomer) {
      fetchUnpaidInvoicesByCustomer(selectedCustomer);
      setSelectedInvoices([]);
    } else {
      setInvoices([]);
      setSelectedInvoices([]);
    }
  }, [selectedCustomer]);

  const fetchCustomersByType = async (type) => {
    setLoadingCustomers(true);
    setError(null);
    try {
      const limit = 100; // backend max_limit
      let all = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const data = await api.get(`/customers/`, {
          params: {
            customer_type: type,
            is_active: true,
            limit,
            offset,
            minimal: 1,
          },
        });
        const page = data.results || data || [];
        all = all.concat(page);
        hasMore = page.length === limit;
        offset += limit;
      }
      setCustomers(all);
    } catch (err) {
      console.error("Error fetching customers:", err);
      setError(err.message || "Failed to load customers. Please try again.");
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchUnpaidInvoicesByCustomer = async (customerId) => {
    setLoadingInvoices(true);
    setError(null);
    try {
      const allInvoices = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;
      while (hasMore) {
        const data = await api.get(`/bills/invoices/`, {
          params: { customer_id: customerId, limit, offset },
        });
        const page = data.results || data || [];
        const items = Array.isArray(page) ? page : [];
        allInvoices.push(...items);
        hasMore = items.length === limit;
        offset += limit;
      }
      const payableInvoices = allInvoices
        .filter((inv) => inv.status !== "paid")
        .sort((a, b) => b.id - a.id);
      setInvoices(payableInvoices);
    } catch (err) {
      console.error("Error fetching invoices:", err);
      setError(err.message || "Failed to load invoices. Please try again.");
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleInvoiceCheckboxChange = (invoiceId, checked) => {
    if (checked) {
      setSelectedInvoices([...selectedInvoices, invoiceId]);
    } else {
      setSelectedInvoices(selectedInvoices.filter((id) => id !== invoiceId));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (
      !selectedInvoices.length ||
      !paymentMethod ||
      !amount
    ) {
      setError("Please select invoices, payment method, and enter amount.");
      return;
    }
    if (!transactionId) {
      setError("Transaction ID is required for cash/bank payments.");
      return;
    }

    const totalAmount = parseFloat(amount);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }

    const adjTransfer = adjustmentTransferEnabled ? (parseFloat(adjustmentTransferAmount) || 0) : 0;
    if (adjTransfer < 0) {
      setError("Adjustment transfer amount cannot be negative.");
      return;
    }
    if (adjTransfer > totalAmount) {
      setError("Adjustment transfer amount must be less than or equal to the total amount.");
      return;
    }

    setSubmitting(true);
    try {
      // Create payment - backend handles both master and details creation
      // Get the entitlement_id from the first selected invoice
      const firstInvoice = selectedInvoiceObjects[0];
      // Handle both direct property and nested object cases
      const entitlementId = typeof firstInvoice?.customer_entitlement_master_id === 'object' 
        ? firstInvoice?.customer_entitlement_master_id?.id 
        : firstInvoice?.customer_entitlement_master_id;
      
      if (!entitlementId) {
        setError("Unable to determine entitlement from selected invoices.");
        return;
      }

      const paymentData = {
        payment_date: paymentDate,
        payment_method: paymentMethod,
        customer_entitlement_master_id: parseInt(entitlementId),
        pay_amount: totalAmount,
        adjustment_transfer_amount: adjTransfer,
        transaction_id: transactionId.trim(),
        remarks: remarks.trim(),
      };

      // Send appropriate field based on number of invoices
      // Ensure invoice IDs are properly formatted as integers
      if (selectedInvoices.length === 1) {
        paymentData.invoice_master_id = parseInt(selectedInvoices[0]);
      } else {
        paymentData.invoice_master_ids = selectedInvoices.map(id => parseInt(id));
      }

      console.log('Sending payment data:', paymentData);

      const response = await api.post("/payments/", paymentData);

      setSuccess("Payment created successfully!");

      // Navigate to payments list after successful creation
      setTimeout(() => {
        navigate("/payments");
      }, 1000);

      // Reset form
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setCustomerType("");
      setSelectedCustomer("");
      setSelectedInvoices([]);
      setPaymentMethod("");
      setAmount("");
      setAdjustmentTransferEnabled(false);
      setAdjustmentTransferAmount("");
      setTransactionId("");
      setRemarks("");
    } catch (err) {
      console.error("Error creating payment:", err);
      
      // More detailed error handling
      let errorMessage = "Failed to create payment. Please try again.";
      
      if (err.response) {
        console.log('Error response:', err.response.data);
        
        // Handle different types of error responses
        if (err.response.data.detail) {
          errorMessage = err.response.data.detail;
        } else if (err.response.data.non_field_errors) {
          errorMessage = err.response.data.non_field_errors.join(', ');
        } else if (err.response.data.invoice_master_id) {
          errorMessage = `Invoice error: ${err.response.data.invoice_master_id.join(', ')}`;
        } else if (err.response.data.pay_amount) {
          errorMessage = `Amount error: ${err.response.data.pay_amount.join(', ')}`;
        } else if (typeof err.response.data === 'object') {
          // If it's an object with multiple fields, get first error
          const firstKey = Object.keys(err.response.data)[0];
          if (err.response.data[firstKey]) {
            errorMessage = `${firstKey}: ${err.response.data[firstKey].join ? err.response.data[firstKey].join(', ') : err.response.data[firstKey]}`;
          }
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
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
      className={`min-h-screen p-6 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1
            className={`text-2xl font-bold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Create Payment
          </h1>
          <p className={`mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Create a payment by selecting customer, invoices, payment
            method, and amount.
          </p>
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
              {error}
            </div>
          )}

          {/* Success Alert */}
          {success && (
            <div className="mb-6 p-4 rounded-lg bg-green-100 border border-green-400 text-green-700">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Payment Date */}
            <div>
              <label className={labelClass}>
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            {/* Customer Type Select */}
            <div>
              <label className={labelClass}>
                Customer Type <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={CUSTOMER_TYPES}
                value={customerType}
                onChange={setCustomerType}
                placeholder="Select Customer Type"
                disabled={false}
                required={true}
                isDark={isDark}
              />
            </div>

            {/* Customer Select */}
            <div>
              <label className={labelClass}>
                Customer <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={customers.map(customer => ({
                  value: customer.id,
                  label: [customer.customer_name, customer.company_name].filter(Boolean).join(" – ") || `Customer #${customer.id}`,
                }))}
                value={selectedCustomer}
                onChange={setSelectedCustomer}
                placeholder={
                  !customerType
                    ? "Select customer type first"
                    : customers.length === 0
                    ? "No customers found"
                    : "Select Customer"
                }
                disabled={!customerType || customers.length === 0}
                required={true}
                isDark={isDark}
                loading={loadingCustomers}
                loadingText="Loading customers..."
              />
            </div>

            {/* Invoices Checkboxes */}
            <div>
              <label className={labelClass}>
                Unpaid Invoices <span className="text-red-500">*</span>
              </label>
              <p className={`text-xs mb-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Select the invoice(s) to pay. Each invoice displays the billing month for clarity. (Customer must be selected first.)
              </p>
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
              ) : invoices.length === 0 ? (
                <p
                  className={`text-sm ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {!selectedCustomer
                    ? "Select a customer first"
                    : "No unpaid invoices available for this customer"}
                </p>
              ) : (
                <div
                  className={`space-y-2 max-h-40 overflow-y-auto border rounded-lg p-4 ${
                    isDark
                      ? "border-gray-600 bg-gray-700"
                      : "border-gray-300 bg-gray-50"
                  }`}
                >
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center space-x-3"
                    >
                      <input
                        type="checkbox"
                        id={`invoice-${invoice.id}`}
                        checked={selectedInvoices.includes(invoice.id)}
                        onChange={(e) =>
                          handleInvoiceCheckboxChange(
                            invoice.id,
                            e.target.checked
                          )
                        }
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label
                        htmlFor={`invoice-${invoice.id}`}
                        className={`text-sm cursor-pointer ${
                          isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        <span className="font-medium">{invoice.invoice_number}</span>
                        {invoice.issue_date && (
                          <span className={`mx-1.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                            · {formatInvoiceMonth(invoice.issue_date)} ·
                          </span>
                        )}
                        <span>
                          {invoice.total_balance_due ||
                            invoice.total_bill_amount ||
                            0}{" "}
                          BDT
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
              {selectedInvoices.length > 0 && (
                <div
                  className={`mt-4 p-3 rounded-lg ${
                    isDark ? "bg-gray-700" : "bg-blue-50"
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${
                      isDark ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Selected Invoices: {selectedInvoices.length}
                  </p>
                  <p
                    className={`text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Total Amount: {totalSelectedAmount} BDT
                  </p>
                  {amount && (
                    <p
                      className={`text-sm ${
                        balance >= 0
                          ? isDark
                            ? "text-green-400"
                            : "text-green-600"
                          : isDark
                          ? "text-red-400"
                          : "text-red-600"
                      }`}
                    >
                      Balance: {balance} BDT{" "}
                      {balance >= 0 ? "(Underpaid)" : "(Overpaid)"}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Payment Method Select */}
            <div>
              <label className={labelClass}>
                Payment Method <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={PAYMENT_METHODS}
                value={paymentMethod}
                onChange={setPaymentMethod}
                placeholder="Select Payment Method"
                disabled={false}
                required={true}
                isDark={isDark}
              />
            </div>

            {/* Amount */}
            <div>
              <label className={labelClass}>
                Amount <span className="text-red-500">*</span> (Total received amount)
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (adjustmentTransferEnabled && parseFloat(e.target.value || 0) < parseFloat(adjustmentTransferAmount || 0)) {
                    setAdjustmentTransferAmount("");
                  }
                }}
                className={inputClass}
                placeholder="Enter amount"
                required
              />
              <p className={`mt-1 text-xs ${isDark ? "text-silver-400" : "text-gray-500"}`}>
                Overpayment is allowed. The excess amount is recorded as customer deposit.
              </p>
            </div>

            <div className={`p-4 rounded-lg border ${isDark ? "border-gray-600 bg-gray-700/50" : "border-gray-300 bg-gray-50"}`}>
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id="adjustment-transfer-enable"
                    checked={adjustmentTransferEnabled}
                    onChange={(e) => {
                      setAdjustmentTransferEnabled(e.target.checked);
                      if (!e.target.checked) setAdjustmentTransferAmount("");
                    }}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                  <label htmlFor="adjustment-transfer-enable" className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    Adjustment Transfer - move part to customer deposit
                  </label>
                </div>
                {adjustmentTransferEnabled && (
                  <div>
                    {!amount && (
                      <p className={`text-xs mb-2 ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                        Enter total amount above first.
                      </p>
                    )}
                    <label className={`block text-sm mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      Adjustment Transfer Amount (optional)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={parseFloat(amount) || undefined}
                      value={adjustmentTransferAmount}
                      onChange={(e) => setAdjustmentTransferAmount(e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 23000"
                      disabled={!amount}
                    />
                    {amount && (
                      <div className={`mt-2 p-3 rounded text-sm ${isDark ? "bg-gray-800" : "bg-white"}`}>
                        <p className={isDark ? "text-gray-300" : "text-gray-700"}>
                          <strong>Invoice Payment Amount</strong> = {invoicePaymentAmount.toLocaleString("en-BD", { minimumFractionDigits: 2 })} BDT
                          {adjAmt > 0 && (
                            <span className="block mt-1 text-xs">
                              ({amt.toLocaleString()} − {adjAmt.toLocaleString()} to deposit)
                            </span>
                          )}
                        </p>
                        {adjAmt > 0 && (
                          <p className={`mt-1 text-xs ${isDark ? "text-green-400" : "text-green-600"}`}>
                            {adjAmt.toLocaleString("en-BD", { minimumFractionDigits: 2 })} BDT will be added to customer deposit.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

            <div>
                <label className={labelClass}>
                  Transaction ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className={inputClass}
                  placeholder="Bank ref, cheque number, etc."
                  required
                />
              </div>

            {/* Remarks */}
            <div>
              <label className={labelClass}>Remarks</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className={inputClass}
                placeholder="Enter remarks"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={
                  submitting ||
                  !selectedInvoices.length ||
                  !paymentMethod ||
                  !amount ||
                  (!isCreditBalance && !transactionId)
                }
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                  submitting ||
                  !selectedInvoices.length ||
                  !paymentMethod ||
                  !amount
                    ? "bg-gray-400 cursor-not-allowed text-gray-200"
                    : "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:from-indigo-700 hover:to-cyan-700 shadow-lg hover:shadow-xl"
                }`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Creating Payment...</span>
                  </span>
                ) : (
                  "Create Payment"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
