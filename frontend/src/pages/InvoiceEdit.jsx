import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../services/api";
import { packageService } from "../services/packageService";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" }).format(value || 0);
}

export default function InvoiceEdit() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(location.state?.invoice || null);
  const [loading, setLoading] = useState(!invoice);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [packages, setPackages] = useState([]);
  const [discountAmount, setDiscountAmount] = useState("");
  const [newLine, setNewLine] = useState({
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    package_master_id: "",
    mbps: "",
    unit_price: "",
    vat_rate: "",
    discount_rate: 0,
    remarks: "",
  });

  useEffect(() => {
    if (!invoice && id) {
      setLoading(true);
      api
        .get(`/bills/invoices/${id}/`)
        .then((data) => {
          setInvoice(Array.isArray(data) ? data[0] : data);
        })
        .catch((err) => setError(err.message || "Failed to load invoice"))
        .finally(() => setLoading(false));
    }
  }, [id, invoice]);

  useEffect(() => {
    if (!invoice) return;
    const currentDiscount = invoice.total_discount_amount ?? 0;
    setDiscountAmount(currentDiscount.toString());
  }, [invoice]);

  useEffect(() => {
    if (!showAddForm) return;
    packageService
      .getAllPackages({ limit: 100, pageSize: 100 })
      .then((res) => {
        const list = res?.results ?? res?.data ?? (Array.isArray(res) ? res : []);
        setPackages(Array.isArray(list) ? list : []);
      })
      .catch(() => setPackages([]));
  }, [showAddForm]);

  const handleHeaderChange = (field, value) => {
    setInvoice((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  const handleDetailChange = (detailId, field, value) => {
    setInvoice((prev) => {
      if (!prev?.details) return prev;
      return {
        ...prev,
        details: prev.details.map((d) =>
          d.id === detailId ? { ...d, [field]: value } : d
        ),
      };
    });
  };

  const handleSaveHeader = async () => {
    if (!invoice) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch(`/bills/invoices/${invoice.id}/`, {
        issue_date: invoice.issue_date,
        remarks: invoice.remarks,
      });
      setInvoice((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (err) {
      setError(err.message || "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDetail = async (detail) => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        mbps: detail.mbps,
        unit_price: detail.unit_price,
        start_date: detail.start_date,
        end_date: detail.end_date,
        vat_rate: detail.vat_rate,
        sub_discount_rate: detail.sub_discount_rate,
        remarks: detail.remarks,
      };
      const updated = await api.patch(`/bills/invoice-details/${detail.id}/`, payload);
      setInvoice((prev) => {
        if (!prev?.details) return prev;
        return {
          ...prev,
          details: prev.details.map((d) => (d.id === detail.id ? { ...d, ...updated } : d)),
          total_bill_amount: updated.total_bill_amount ?? prev.total_bill_amount,
          total_balance_due: updated.total_balance_due ?? prev.total_balance_due,
          total_paid_amount: prev.total_paid_amount,
          total_vat_amount: updated.total_vat_amount ?? prev.total_vat_amount,
          total_discount_amount: updated.total_discount_amount ?? prev.total_discount_amount,
        };
      });
      await refreshInvoice();
    } catch (err) {
      setError(err.message || "Failed to save line");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDetail = async (detail) => {
    if (!window.confirm("Remove this line from the invoice?")) return;
    setSaving(true);
    setError(null);
    try {
      await api.delete(`/bills/invoice-details/${detail.id}/`);
      setInvoice((prev) => {
        if (!prev?.details) return prev;
        return {
          ...prev,
          details: prev.details.filter((d) => d.id !== detail.id),
        };
      });
      await refreshInvoice();
    } catch (err) {
      setError(err.message || "Failed to delete line");
    } finally {
      setSaving(false);
    }
  };

  const refreshInvoice = async () => {
    if (!invoice?.id) return;
    try {
      const data = await api.get(`/bills/invoices/${invoice.id}/`);
      const inv = Array.isArray(data) ? data[0] : data;
      setInvoice(inv);
    } catch (e) {
      console.error("Refresh failed", e);
    }
  };

  const handleRecalculate = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.post(`/bills/invoices/${invoice.id}/recalculate/`);
      setInvoice((prev) => (prev ? { ...prev, ...res.invoice } : res.invoice));
    } catch (err) {
      setError(err.message || "Recalculation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyDiscount = async () => {
    if (!invoice?.id) return;
    setSaving(true);
    setError(null);
    try {
      const amount = discountAmount !== "" ? parseFloat(discountAmount) : 0;
      const res = await api.post(`/bills/invoices/${invoice.id}/apply-discount/`, {
        discount_amount: amount,
      });
      setInvoice((prev) => (prev ? { ...prev, ...res.invoice } : res.invoice));
      await refreshInvoice();
    } catch (err) {
      setError(err.message || "Failed to apply discount");
    } finally {
      setSaving(false);
    }
  };

  const handleAddDetail = async () => {
    if (!newLine.start_date) {
      setError("Start date is required");
      return;
    }
    const pkgId = newLine.package_master_id ? parseInt(newLine.package_master_id, 10) : null;
    if (!pkgId) {
      setError("Please select a package (e.g. IPT, CDN)");
      return;
    }
    const selectedPackage = packages.find((p) => p.id === pkgId);
    const lineType = selectedPackage?.package_type || invoice?.entitlement_details?.customer_master?.customer_type || "bw";
    setSaving(true);
    setError(null);
    try {
      const vatRate = newLine.vat_rate !== "" ? parseFloat(newLine.vat_rate) : (invoice.utility_info?.vat_rate ?? 0);
      const discountRate = parseFloat(newLine.discount_rate) || 0;
      const payload = {
        lines: [{
          start_date: newLine.start_date,
          end_date: newLine.end_date || undefined,
          package_master_id: pkgId,
          type: lineType,
          mbps: newLine.mbps !== "" ? parseFloat(newLine.mbps) : null,
          unit_price: newLine.unit_price !== "" ? parseFloat(newLine.unit_price) : null,
          vat_rate: vatRate,
          discount_rate: discountRate,
          remarks: newLine.remarks || "",
        }],
        vat_rate: vatRate,
        discount_rate: discountRate,
      };
      const res = await api.post(`/bills/invoices/${invoice.id}/add-details/`, payload);
      setInvoice((prev) => (prev ? { ...prev, ...res.invoice } : res.invoice));
      await refreshInvoice();
      setNewLine({
        start_date: new Date().toISOString().slice(0, 10),
        end_date: "",
        package_master_id: "",
        mbps: "",
        unit_price: "",
        vat_rate: invoice.utility_info?.vat_rate ?? "",
        discount_rate: 0,
        remarks: "",
      });
      setShowAddForm(false);
    } catch (err) {
      setError(err.message || "Failed to add bill entry");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !invoice) {
    return (
      <div className="p-6 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Edit Invoice - {invoice.invoice_number}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/invoice-view", { state: { invoice } })}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            View
          </button>
          <button
            onClick={() => navigate("/invoices")}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Back to List
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow border p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Invoice Header</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
            <input
              type="date"
              value={(invoice.issue_date || "").toString().slice(0, 10)}
              onChange={(e) => handleHeaderChange("issue_date", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <input
              type="text"
              value={invoice.remarks || ""}
              onChange={(e) => handleHeaderChange("remarks", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        <button
          onClick={handleSaveHeader}
          disabled={saving}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Header"}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Line Items</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <span>+</span>
              Add Bill Entry
            </button>
            <button
              onClick={handleRecalculate}
              disabled={saving}
              className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Recalculate Totals
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-medium mb-3">New Bill Entry</h3>
            <p className="text-xs text-gray-600 mb-3">
              Add a new line item. Subtotal is calculated from MBPS, rate, and dates. Totals are recalculated automatically.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start Date *</label>
                <input
                  type="date"
                  value={newLine.start_date}
                  onChange={(e) => setNewLine((p) => ({ ...p, start_date: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={newLine.end_date}
                  onChange={(e) => setNewLine((p) => ({ ...p, end_date: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Package *</label>
                <select
                  value={newLine.package_master_id}
                  onChange={(e) => setNewLine((p) => ({ ...p, package_master_id: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                >
                  <option value="">Select package (IPT, CDN, etc.)</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.package_name || `Package ${pkg.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">MBPS</label>
                <input
                  type="number"
                  step="0.01"
                  value={newLine.mbps}
                  onChange={(e) => setNewLine((p) => ({ ...p, mbps: e.target.value }))}
                  placeholder="e.g. 100"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Unit Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={newLine.unit_price}
                  onChange={(e) => setNewLine((p) => ({ ...p, unit_price: e.target.value }))}
                  placeholder="e.g. 10"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">VAT %</label>
                <input
                  type="number"
                  step="0.01"
                  value={newLine.vat_rate !== "" ? newLine.vat_rate : (invoice.utility_info?.vat_rate ?? 0)}
                  onChange={(e) => setNewLine((p) => ({ ...p, vat_rate: e.target.value }))}
                  placeholder="0"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Discount %</label>
                <input
                  type="number"
                  step="0.01"
                  value={newLine.discount_rate}
                  onChange={(e) => setNewLine((p) => ({ ...p, discount_rate: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                <input
                  type="text"
                  value={newLine.remarks}
                  onChange={(e) => setNewLine((p) => ({ ...p, remarks: e.target.value }))}
                  placeholder="Optional"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleAddDetail}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                {saving ? "Adding…" : "Add Line"}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Start</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">End</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">MBPS</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">VAT %</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Disc %</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Sub Total</th>
                <th className="px-4 py-2 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(invoice.details || []).map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">{d.entitlement_type || d.type || "—"}</td>
                  <td className="px-4 py-2">
                    <input
                      type="date"
                      value={(d.start_date || "").toString().slice(0, 10)}
                      onChange={(e) => handleDetailChange(d.id, "start_date", e.target.value)}
                      className="w-32 px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="date"
                      value={(d.end_date || "").toString().slice(0, 10)}
                      onChange={(e) => handleDetailChange(d.id, "end_date", e.target.value)}
                      className="w-32 px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={d.mbps ?? ""}
                      onChange={(e) => handleDetailChange(d.id, "mbps", e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded text-right"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={d.unit_price ?? ""}
                      onChange={(e) => handleDetailChange(d.id, "unit_price", e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded text-right"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={d.vat_rate ?? ""}
                      onChange={(e) => handleDetailChange(d.id, "vat_rate", e.target.value ? parseFloat(e.target.value) : 0)}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-right"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={d.sub_discount_rate ?? ""}
                      onChange={(e) => handleDetailChange(d.id, "sub_discount_rate", e.target.value ? parseFloat(e.target.value) : 0)}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-right"
                    />
                  </td>
                  <td className="px-4 py-2 text-sm text-right">{formatCurrency(d.line_total ?? d.sub_total)}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleSaveDetail(d)}
                        disabled={saving}
                        className="text-blue-600 hover:underline text-sm disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => handleDeleteDetail(d)}
                        disabled={saving}
                        className="text-red-600 hover:underline text-sm disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium mb-2">Totals (auto-calculated)</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total Bill:</span>
            <span className="ml-2 font-medium">{formatCurrency(invoice.total_bill_amount)}</span>
          </div>
          <div>
            <span className="text-gray-600">Paid:</span>
            <span className="ml-2 font-medium">{formatCurrency(invoice.total_paid_amount)}</span>
          </div>
          <div>
            <span className="text-gray-600">Balance Due:</span>
            <span className="ml-2 font-medium">{formatCurrency(invoice.total_balance_due)}</span>
          </div>
          <div>
            <span className="text-gray-600">VAT:</span>
            <span className="ml-2">{formatCurrency(invoice.total_vat_amount)}</span>
          </div>
          <div>
            <span className="text-gray-600">Discount:</span>
            <span className="ml-2">{formatCurrency(invoice.total_discount_amount)}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600 mb-1">Discount Amount (BDT)</label>
            <input
              type="number"
              step="0.01"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              className="w-40 px-2 py-1 text-sm border border-gray-300 rounded"
            />
          </div>
          <button
            onClick={handleApplyDiscount}
            disabled={saving}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Apply Discount
          </button>
        </div>
      </div>
    </div>
  );
}
