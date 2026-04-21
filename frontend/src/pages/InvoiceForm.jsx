import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import SearchableSelect from "../components/SearchableSelect";
import api from "../services/api";

const CUSTOMER_TYPES = [
  { value: "bw", label: "Bandwidth" },
];

/** Format date as "January 2025" for clear month display */
function formatBillMonth(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Get user-friendly period label for entitlement bill */
function getEntitlementPeriodLabel(bill) {
  const lastBilled = bill.last_bill_invoice_date;
  if (lastBilled) {
    return `Last billed: ${formatBillMonth(lastBilled)}`;
  }
  const activated = bill.activation_date;
  if (activated) {
    return `From: ${formatBillMonth(activated)}`;
  }
  return "";
}

export default function InvoiceForm() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Refs
  const invoiceDateInputRef = useRef(null);
  const selectAllCheckboxRef = useRef(null);

  // Form state
  const [customerType, setCustomerType] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [bills, setBills] = useState([]);
  const [selectedBillIds, setSelectedBillIds] = useState([]);
  const [selectedBill, setSelectedBill] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [billDate, setBillDate] = useState("");
  const [vatRate, setVatRate] = useState("");
  const [discountRate, setDiscountRate] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);

  // Zones from bills (when customer has zone-based entitlements)
  const zones = React.useMemo(() => {
    const names = (bills || []).map((b) => b.zone_name).filter((z) => z != null && String(z).trim() !== "");
    return [...new Set(names)];
  }, [bills]);

  // Bills filtered by selected zone
  const filteredBills = React.useMemo(() => {
    if (!selectedZone) return bills;
    return (bills || []).filter((b) => b.zone_name === selectedZone);
  }, [bills, selectedZone]);

  const hasZones = zones.length > 0;

  // Keep "Select all" checkbox indeterminate state in sync
  useEffect(() => {
    const el = selectAllCheckboxRef.current;
    if (!el || !hasZones || filteredBills.length === 0) return;
    const selectedCount = filteredBills.filter((b) => selectedBillIds.includes(b.id)).length;
    el.indeterminate = selectedCount > 0 && selectedCount < filteredBills.length;
  }, [hasZones, filteredBills, selectedBillIds]);

  // Loading states
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingBills, setLoadingBills] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Error state
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Fetch customers when customer type changes
  useEffect(() => {
    if (customerType) {
      fetchCustomersByType(customerType);
      // Reset dependent fields
      setSelectedCustomer("");
      setBills([]);
      setSelectedBillIds([]);
      setSelectedBill("");
      setSelectedZone("");
    } else {
      setCustomers([]);
      setSelectedCustomer("");
      setBills([]);
      setSelectedBillIds([]);
      setSelectedBill("");
      setSelectedZone("");
    }
  }, [customerType]);

  // Fetch bills when customer changes
  useEffect(() => {
    if (selectedCustomer) {
      fetchBillsByCustomer(selectedCustomer);
      setSelectedBillIds([]);
      setSelectedBill("");
      setSelectedZone("");
    } else {
      setBills([]);
      setSelectedBillIds([]);
      setSelectedBill("");
      setSelectedZone("");
    }
  }, [selectedCustomer]);

  const fetchCustomersByType = async (type) => {
    setLoadingCustomers(true);
    setError(null);
    try {
      // Backend uses limit/offset pagination (max limit=100). Fetch all customers
      // of this type by making multiple requests.
      const allCustomers = [];
      const limit = 100;
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
        const results = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data?.data)
              ? data.data
              : [];
        allCustomers.push(...results);
        hasMore = results.length === limit;
        offset += limit;
      }

      // Filter customers who have active entitlements
      const customersWithEntitlements = allCustomers.filter(customer =>
        customer.active_entitlements_count > 0
      );

      setCustomers(customersWithEntitlements);

      if (customersWithEntitlements.length === 0 && allCustomers.length > 0) {
        console.log(`No customers with active entitlements found for type: ${type}`);
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
      setError(err.message || "Failed to load customers. Please try again.");
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchBillsByCustomer = async (customerId) => {
    setLoadingBills(true);
    setError(null);
    try {
      const data = await api.get(`/bills/entitlements/`, {
        params: {
          customer_master_id: customerId,
          minimal: 1,
          limit: 100,
          exclude_invoiced: 1,
        },
      });
      setBills(data.results || data || []);
    } catch (err) {
      console.error("Error fetching bills:", err);
      setError(err.message || "Failed to load bills. Please try again.");
      setBills([]);
    } finally {
      setLoadingBills(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const entitlementIds = hasZones
      ? selectedBillIds
      : (selectedBill ? [selectedBill] : []);

    if (entitlementIds.length === 0 || !billDate) {
      setError(
        entitlementIds.length === 0
          ? hasZones
            ? "Please select at least one bill/entitlement and enter invoice date."
            : "Please select a bill/entitlement and enter invoice date."
          : "Please enter invoice date."
      );
      return;
    }

    setSubmitting(true);
    try {
      const isMulti = entitlementIds.length > 1;
      const discountRateNum = discountRate === "" || discountRate == null ? null : parseFloat(discountRate);
      const previewPayload = {
        target_date: billDate,
        vat_rate: vatRate || null,
        discount_rate: Number.isFinite(discountRateNum) ? discountRateNum : null,
      };
      if (isMulti) {
        previewPayload.entitlement_ids = entitlementIds;
      } else {
        previewPayload.entitlement_id = entitlementIds[0];
      }

      const response = await api.post("/bills/invoices/preview/", previewPayload);
      setSuccess("Invoice preview generated successfully!");

      // requestData for Create Invoice and for display on InvoiceSingle (so discount % shows)
      const requestData = {
        target_date: billDate,
        vat_rate: vatRate || null,
        discount_rate: Number.isFinite(discountRateNum) ? discountRateNum : null,
      };
      if (isMulti) {
        requestData.entitlement_ids = entitlementIds;
      } else {
        requestData.entitlement_id = entitlementIds[0];
      }

      navigate("/invoice-single", { state: { previewData: response, requestData } });
    } catch (err) {
      console.error("Error generating preview:", err);
      setError(err.response?.data?.detail || err.response?.data?.error || "Failed to generate invoice preview. Please try again.");
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
    <div className={`min-h-screen p-6 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            Preview Invoice
          </h1>
          <p className={`mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Preview invoice by selecting customer type, customer, bill, and date.
          </p>
        </div>

        {/* Form Card */}
        <div
          className={`rounded-xl shadow-lg p-6 ${
            isDark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"
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

            {/* Issue Date */}
            {/* <div>
              <label className={labelClass}>
                Issue Date
              </label>
              <input
                type="date"
                value={issueDate}
                readOnly
                className={inputClass}
              />
            </div> */}

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

            {/* Zone Name – only when customer has zone-based bills (Bandwidth with zone_name) */}
            {zones.length > 0 && (
              <div>
                <label className={labelClass}>
                  Zone Name
                </label>
                <SearchableSelect
                  options={[
                    { value: "", label: "All Zones" },
                    ...zones.map((zone) => ({ value: zone, label: zone })),
                  ]}
                  value={selectedZone}
                  onChange={setSelectedZone}
                  placeholder="Select Zone (optional)"
                  disabled={bills.length === 0}
                  required={false}
                  isDark={isDark}
                />
                <p className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  Select a Zone to see only bill entries for that Zone in the Bill/Entitlement list below.
                </p>
              </div>
            )}

            {/* Bill / Entitlement – single-select for non-zoned customers, multi-select for zoned customers */}
            <div>
              <label className={labelClass}>
                Bill / Entitlement <span className="text-red-500">*</span>
              </label>
              <p className={`text-xs mb-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Select the entitlement bill(s) to invoice. Each shows when it was last billed (or activated) for clarity.
                {hasZones && " For zone-based customers, multiple bills are grouped by Zone in the preview."}
              </p>

              {hasZones ? (
                <>
                  {loadingBills ? (
                    <div className="flex items-center py-4">
                      <LoadingSpinner size="sm" />
                      <span className={`ml-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>Loading bills...</span>
                    </div>
                  ) : !selectedCustomer || bills.length === 0 ? (
                    <div
                      className={`rounded-lg border p-4 text-sm ${isDark ? "bg-gray-700 border-gray-600 text-gray-400" : "bg-gray-50 border-gray-200 text-gray-500"}`}
                    >
                      {!selectedCustomer ? "Select a customer first" : "No bills found for this customer"}
                    </div>
                  ) : filteredBills.length === 0 ? (
                    <div
                      className={`rounded-lg border p-4 text-sm ${isDark ? "bg-gray-700 border-gray-600 text-gray-400" : "bg-gray-50 border-gray-200 text-gray-500"}`}
                    >
                      No bill entries for this Zone. Select &quot;All Zones&quot; or another Zone.
                    </div>
                  ) : (
                    <div
                      className={`rounded-lg border p-3 max-h-56 overflow-y-auto ${
                        isDark ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"
                      }`}
                    >
                      <label
                        className={`flex items-center gap-2 py-2 cursor-pointer rounded px-2 mb-1 font-medium ${
                          isDark ? "border-gray-600 hover:bg-gray-600 text-gray-200" : "border-gray-200 hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <input
                          ref={selectAllCheckboxRef}
                          type="checkbox"
                          checked={filteredBills.length > 0 && filteredBills.every((b) => selectedBillIds.includes(b.id))}
                          onChange={() => {
                            const allSelected = filteredBills.every((b) => selectedBillIds.includes(b.id));
                            setSelectedBillIds((prev) => {
                              if (allSelected) {
                                return prev.filter((id) => !filteredBills.some((b) => b.id === id));
                              }
                              const toAdd = filteredBills.map((b) => b.id).filter((id) => !prev.includes(id));
                              return [...prev, ...toAdd];
                            });
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Select all ({filteredBills.length} bill{filteredBills.length !== 1 ? "s" : ""})</span>
                      </label>
                      <div className="border-t pt-1 mt-1" style={{ borderColor: isDark ? "rgb(75 85 99)" : "rgb(229 231 235)" }} />
                      {filteredBills.map((bill) => {
                        const isChecked = selectedBillIds.includes(bill.id);
                        const periodLabel = getEntitlementPeriodLabel(bill);
                        const baseLabel = bill.zone_name
                          ? `${bill.bill_number} (${bill.zone_name})`
                          : bill.bill_number;
                        const label = periodLabel
                          ? `${baseLabel} · ${periodLabel} · ${bill.total_bill ?? 0} BDT`
                          : `${baseLabel} · ${bill.total_bill ?? 0} BDT`;
                        return (
                          <label
                            key={bill.id}
                            className={`flex items-center gap-2 py-2 cursor-pointer rounded px-2 border-b last:border-b-0 ${
                              isDark ? "border-gray-600 hover:bg-gray-600" : "border-gray-100 hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedBillIds((prev) =>
                                  isChecked ? prev.filter((id) => id !== bill.id) : [...prev, bill.id]
                                );
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className={isDark ? "text-gray-200" : "text-gray-800"}>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {selectedBillIds.length > 0 && (
                    <p className={`mt-1 text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      {selectedBillIds.length} bill(s) selected. Preview will show {selectedBillIds.length > 1 ? "them grouped by Zone" : "this bill"}.
                    </p>
                  )}
                </>
              ) : (
                <>
                  {loadingBills ? (
                    <div className="flex items-center py-4">
                      <LoadingSpinner size="sm" />
                      <span className={`ml-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>Loading bills...</span>
                    </div>
                  ) : !selectedCustomer || bills.length === 0 ? (
                    <div
                      className={`rounded-lg border p-4 text-sm ${isDark ? "bg-gray-700 border-gray-600 text-gray-400" : "bg-gray-50 border-gray-200 text-gray-500"}`}
                    >
                      {!selectedCustomer ? "Select a customer first" : "No bills found for this customer"}
                    </div>
                  ) : (
                    <SearchableSelect
                      options={bills.map((bill) => {
                        const periodLabel = getEntitlementPeriodLabel(bill);
                        const label = periodLabel
                          ? `${bill.bill_number} · ${periodLabel} · ${bill.total_bill ?? 0} BDT`
                          : `${bill.bill_number} · ${bill.total_bill ?? 0} BDT`;
                        return { value: bill.id, label };
                      })}
                      value={selectedBill}
                      onChange={setSelectedBill}
                      placeholder="Select Bill / Entitlement"
                      disabled={!selectedCustomer || bills.length === 0}
                      required={true}
                      isDark={isDark}
                      loading={loadingBills}
                      loadingText="Loading bills..."
                    />
                  )}
                </>
              )}
            </div>

            {/* Bill Date */}
            <div>
              <label className={labelClass}>
                Invoice Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  ref={invoiceDateInputRef}
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className={`${inputClass} pr-10`}
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    if (invoiceDateInputRef.current) {
                      if (typeof invoiceDateInputRef.current.showPicker === "function") {
                        invoiceDateInputRef.current.showPicker();
                      } else {
                        invoiceDateInputRef.current.focus();
                        invoiceDateInputRef.current.click();
                      }
                    }
                  }}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded cursor-pointer hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}
                  aria-label="Open calendar"
                >
                  <Calendar className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* VAT Rate */}
            <div>
              <label className={labelClass}>
                VAT Rate <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                className={inputClass}
                placeholder="Enter VAT rate (e.g., 15)"
                required
              />
            </div>

            {/* Discount Rate (optional) */}
            <div>
              <label className={labelClass}>
                Discount Rate <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={discountRate}
                onChange={(e) => setDiscountRate(e.target.value)}
                className={inputClass}
                placeholder="Enter discount rate (e.g., 5)"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={
                  submitting ||
                  !billDate ||
                  (hasZones ? selectedBillIds.length === 0 : !selectedBill)
                }
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                  submitting || !billDate || (hasZones ? selectedBillIds.length === 0 : !selectedBill)
                    ? "bg-gray-400 cursor-not-allowed text-gray-200"
                    : "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:from-indigo-700 hover:to-cyan-700 shadow-lg hover:shadow-xl"
                }`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Generating Preview...</span>
                  </span>
                ) : (
                  "Preview Invoice"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
