import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../services/api";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" }).format(value || 0);
}

export default function PaymentEdit() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(location.state?.payment || null);
  const [loading, setLoading] = useState(!payment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!payment && id) {
      setLoading(true);
      api
        .get(`/payments/${id}/`)
        .then((data) => setPayment(Array.isArray(data) ? data[0] : data))
        .catch((err) => setError(err.message || "Failed to load payment"))
        .finally(() => setLoading(false));
    }
  }, [id, payment]);

  const handleMasterChange = (field, value) => {
    setPayment((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  const handleDetailChange = (detailId, field, value) => {
    setPayment((prev) => {
      if (!prev?.details) return prev;
      return {
        ...prev,
        details: prev.details.map((d) =>
          d.id === detailId ? { ...d, [field]: value } : d
        ),
      };
    });
  };

  const handleSaveMaster = async () => {
    if (!payment) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/payments/${payment.id}/`, {
        payment_date: payment.payment_date,
        payment_method: payment.payment_method,
        remarks: payment.remarks,
        status: payment.status,
      });
      await refreshPayment();
    } catch (err) {
      setError(err.message || "Failed to save payment");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDetail = async (detail) => {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/payments/payment-details/${detail.id}/`, {
        pay_amount: detail.pay_amount,
        transaction_id: detail.transaction_id,
        remarks: detail.remarks,
        status: detail.status,
      });
      await refreshPayment();
    } catch (err) {
      setError(err.message || "Failed to save payment detail");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDetail = async (detail) => {
    if (!window.confirm("Remove this payment line? Invoice balance will be recalculated.")) return;
    setSaving(true);
    setError(null);
    try {
      await api.delete(`/payments/payment-details/${detail.id}/`);
      await refreshPayment();
    } catch (err) {
      setError(err.message || "Failed to delete payment detail");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!window.confirm("Delete this entire payment? Invoice balance will be recalculated.")) return;
    setSaving(true);
    setError(null);
    try {
      await api.delete(`/payments/${payment.id}/`);
      navigate("/payments");
    } catch (err) {
      setError(err.message || "Failed to delete payment");
      setSaving(false);
    }
  };

  const refreshPayment = async () => {
    if (!payment?.id) return;
    try {
      const data = await api.get(`/payments/${payment.id}/`);
      setPayment(Array.isArray(data) ? data[0] : data);
    } catch (e) {
      console.error("Refresh failed", e);
    }
  };

  if (loading || !payment) {
    return (
      <div className="p-6 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Edit Payment #{payment.id}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/payment-view", { state: { payment } })}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            View
          </button>
          <button
            onClick={() => navigate("/payments")}
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
        <h2 className="text-lg font-medium mb-4">Payment Header</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
            <input
              type="date"
              value={(payment.payment_date || "").toString().slice(0, 10)}
              onChange={(e) => handleMasterChange("payment_date", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <input
              type="text"
              value={payment.payment_method || ""}
              onChange={(e) => handleMasterChange("payment_method", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="e.g. Cash, Bank Transfer"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <input
              type="text"
              value={payment.remarks || ""}
              onChange={(e) => handleMasterChange("remarks", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        <button
          onClick={handleSaveMaster}
          disabled={saving}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Header"}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Payment Details (Amounts)</h2>
        <p className="text-sm text-gray-600 mb-4">
          Editing payment amount updates the invoice balance. Overpayment is stored as customer credit.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(payment.details || []).map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={d.transaction_id || ""}
                      onChange={(e) => handleDetailChange(d.id, "transaction_id", e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      placeholder="Transaction ID"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={d.pay_amount ?? ""}
                      onChange={(e) => handleDetailChange(d.id, "pay_amount", e.target.value ? parseFloat(e.target.value) : 0)}
                      className="w-28 px-2 py-1 text-sm border border-gray-300 rounded text-right"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={d.remarks || ""}
                      onChange={(e) => handleDetailChange(d.id, "remarks", e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={d.status || "completed"}
                      onChange={(e) => handleDetailChange(d.id, "status", e.target.value)}
                      className="px-2 py-1 text-sm border border-gray-300 rounded"
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                    </select>
                  </td>
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

      <div className="bg-gray-50 rounded-lg p-4 flex justify-between items-center">
        <div>
          <span className="text-gray-600">Total Paid: </span>
          <span className="font-medium">{formatCurrency(payment.total_paid)}</span>
          <span className="ml-4 text-gray-600">Invoice Balance: </span>
          <span className="font-medium">{formatCurrency(payment.invoice_balance)}</span>
        </div>
        <button
          onClick={handleDeletePayment}
          disabled={saving}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          Delete Payment
        </button>
      </div>
    </div>
  );
}
