import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Play,
  Mail,
  Calendar,
  Settings,
  Users,
} from "lucide-react";
import api from "../services/api";
import SearchableSelect from "../components/SearchableSelect";

const SCHEDULE_TYPES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "cron", label: "Custom Cron" },
];

const STATUS_FILTERS = [
  { value: "all", label: "All invoices" },
  { value: "unpaid", label: "Unpaid only" },
  { value: "partial", label: "Unpaid and partial" },
];

const WEEKDAYS = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

const defaultForm = {
  name: "",
  enabled: true,
  target_customer: null,
  schedule_type: "daily",
  run_at_hour: 9,
  run_at_minute: 0,
  weekly_day: 0,
  monthly_day: 1,
  cron_expression: "0 9 * * *",
  generate_invoices_before_send: true,
  invoice_status_filter: "unpaid",
  days_lookback: 7,
};

function formatDateTime(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleString();
}

export default function InvoiceAutomation() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorFix, setErrorFix] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorFix(null);
    try {
      const data = await api.get("/bills/invoice-email-schedules/");
      setSchedules(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      const res = err?.response?.data;
      setError(res?.detail || res?.error || err?.message || "Failed to load schedules");
      setErrorFix(res?.fix || null);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const fetchCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const all = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;
      while (hasMore) {
        const data = await api.get("/customers/", {
          params: { is_active: true, limit, offset },
        });
        const results = Array.isArray(data) ? data : data?.results || [];
        all.push(...results);
        hasMore = results.length === limit;
        offset += limit;
      }
      setCustomers(all);
    } catch {
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showForm && customers.length === 0) fetchCustomers();
  }, [showForm, customers.length, fetchCustomers]);

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (s) => {
    setForm({
      name: s.name || "",
      enabled: s.enabled ?? true,
      target_customer: s.target_customer ?? null,
      schedule_type: s.schedule_type || "daily",
      run_at_hour: s.run_at_hour ?? 9,
      run_at_minute: s.run_at_minute ?? 0,
      weekly_day: s.weekly_day ?? 0,
      monthly_day: s.monthly_day ?? 1,
      cron_expression: s.cron_expression || "0 9 * * *",
      generate_invoices_before_send: s.generate_invoices_before_send ?? true,
      invoice_status_filter: s.invoice_status_filter || "unpaid",
      days_lookback: s.days_lookback ?? 7,
    });
    setEditingId(s.id);
    setShowForm(true);
  };

  const handleCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const tc = form.target_customer;
      const payload = {
        ...form,
        target_customer: tc === "" || tc === null || tc === undefined ? null : tc,
        run_at_hour: parseInt(form.run_at_hour, 10) || 9,
        run_at_minute: parseInt(form.run_at_minute, 10) || 0,
        weekly_day: form.schedule_type === "weekly" ? parseInt(form.weekly_day, 10) : null,
        monthly_day: form.schedule_type === "monthly" ? parseInt(form.monthly_day, 10) || 1 : null,
        cron_expression: form.schedule_type === "cron" ? form.cron_expression : "",
      };
      if (editingId) {
        await api.patch(`/bills/invoice-email-schedules/${editingId}/`, payload);
      } else {
        await api.post("/bills/invoice-email-schedules/", payload);
      }
      resetForm();
      fetchSchedules();
    } catch (err) {
      alert(err?.message || "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this schedule?")) return;
    try {
      await api.delete(`/bills/invoice-email-schedules/${id}/`);
      fetchSchedules();
    } catch (err) {
      alert(err?.message || "Failed to delete");
    }
  };

  const handleRunNow = async (id) => {
    setRunningId(id);
    try {
      const res = await api.post(`/bills/invoice-email-schedules/${id}/run-now/`);
      alert(
        `Run completed.\nSent: ${res.sent ?? 0}, Skipped: ${res.skipped ?? 0}, Errors: ${res.errors ?? 0}`
      );
      fetchSchedules();
    } catch (err) {
      alert(err?.message || "Run failed");
    } finally {
      setRunningId(null);
    }
  };

  const handleToggleEnabled = async (s) => {
    try {
      await api.patch(`/bills/invoice-email-schedules/${s.id}/`, { enabled: !s.enabled });
      fetchSchedules();
    } catch (err) {
      alert(err?.message || "Failed to update");
    }
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Mail className="w-7 h-7" />
            Invoice Email Automation
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Automatically generate and email Service Name Invoice PDFs at scheduled intervals.
          </p>
        </div>
        {!errorFix && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Schedule
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <Settings className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                {errorFix ? "Setup required" : "Something went wrong"}
              </h3>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                {error}
              </p>
              {errorFix && (
                <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Run this command in your project directory:</p>
                  <code className="block text-sm font-mono bg-gray-100 dark:bg-gray-900 px-3 py-2 rounded text-gray-800 dark:text-gray-200">
                    {errorFix}
                  </code>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-500 mb-3">
                    After running the command, click the button below to reload.
                  </p>
                  <button
                    onClick={fetchSchedules}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Reload page
                  </button>
                </div>
              )}
              {!errorFix && (
                <button
                  onClick={fetchSchedules}
                  className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : schedules.length === 0 && !showForm ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No schedules yet
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Create a schedule to automatically email Service Name Invoice PDFs to customers.
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add Schedule
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {schedules.map((s) => (
            <div
              key={s.id}
              className={`bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden transition-all ${
                !s.enabled ? "opacity-70" : ""
              }`}
            >
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">
                      {s.name}
                    </h3>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        s.enabled
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                      }`}
                    >
                      {s.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                    <span>
                      {s.schedule_type === "daily" && `Daily at ${String(s.run_at_hour).padStart(2, "0")}:${String(s.run_at_minute).padStart(2, "0")}`}
                      {s.schedule_type === "weekly" && `Weekly on ${WEEKDAYS.find((w) => w.value === s.weekly_day)?.label ?? "—"} at ${String(s.run_at_hour).padStart(2, "0")}:${String(s.run_at_minute).padStart(2, "0")}`}
                      {s.schedule_type === "monthly" && `Monthly on day ${s.monthly_day} at ${String(s.run_at_hour).padStart(2, "0")}:${String(s.run_at_minute).padStart(2, "0")}`}
                      {s.schedule_type === "cron" && `Cron: ${s.cron_expression || "—"}`}
                    </span>
                    <span>•</span>
                    <span>{s.target_customer_name ? s.target_customer_name : "All customers"}</span>
                    <span>•</span>
                    <span>{STATUS_FILTERS.find((f) => f.value === s.invoice_status_filter)?.label ?? s.invoice_status_filter}</span>
                    <span>•</span>
                    <span>Last {s.days_lookback} days</span>
                  </div>
                  {(s.last_run_at || s.next_run_at) && (
                    <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      Last run: {formatDateTime(s.last_run_at)} • Next: {formatDateTime(s.next_run_at)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleEnabled(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      s.enabled
                        ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                    }`}
                  >
                    {s.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => handleRunNow(s.id)}
                    disabled={runningId === s.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-100 text-indigo-800 hover:bg-cyan-200 dark:bg-indigo-900/30 dark:text-cyan-400 rounded-lg text-sm font-medium disabled:opacity-50"
                    title="Run now (test)"
                  >
                    <Play className="w-4 h-4" />
                    {runningId === s.id ? "Running…" : "Run now"}
                  </button>
                  <button
                    onClick={() => handleEdit(s)}
                    className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-gray-400 dark:hover:text-blue-400 rounded-lg"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-gray-400 dark:hover:text-red-400 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSave} className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                {editingId ? "Edit Schedule" : "New Schedule"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Daily unpaid invoices"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={form.enabled}
                    onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="enabled" className="text-sm text-gray-700 dark:text-gray-300">
                    Enabled
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      Send invoices to
                    </span>
                  </label>
                  <SearchableSelect
                    options={[
                      { value: "", label: "All customers" },
                      ...customers.map((c) => ({
                        value: c.id,
                        label: `${c.customer_name || "—"}${c.company_name ? ` (${c.company_name})` : ""}`,
                      })),
                    ]}
                    value={form.target_customer ?? ""}
                    onChange={(v) => setForm((f) => ({ ...f, target_customer: v === "" ? null : v }))}
                    placeholder="Select customer"
                    loading={customersLoading}
                    loadingText="Loading customers..."
                    disabled={customersLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Choose &quot;All customers&quot; to send everyone&apos;s invoices, or select a specific customer.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Schedule type
                  </label>
                  <select
                    value={form.schedule_type}
                    onChange={(e) => setForm((f) => ({ ...f, schedule_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    {SCHEDULE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Hour (0–23)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={form.run_at_hour}
                      onChange={(e) => setForm((f) => ({ ...f, run_at_hour: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Minute (0–59)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={form.run_at_minute}
                      onChange={(e) => setForm((f) => ({ ...f, run_at_minute: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                {form.schedule_type === "weekly" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Day of week
                    </label>
                    <select
                      value={form.weekly_day}
                      onChange={(e) => setForm((f) => ({ ...f, weekly_day: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    >
                      {WEEKDAYS.map((w) => (
                        <option key={w.value} value={w.value}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {form.schedule_type === "monthly" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Day of month (1–31)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={form.monthly_day}
                      onChange={(e) => setForm((f) => ({ ...f, monthly_day: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                )}

                {form.schedule_type === "cron" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Cron expression (min hour day month dow)
                    </label>
                    <input
                      type="text"
                      value={form.cron_expression}
                      onChange={(e) => setForm((f) => ({ ...f, cron_expression: e.target.value }))}
                      placeholder="0 9 * * *"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Example: 0 9 * * * = daily at 9:00 AM
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Invoice status filter
                  </label>
                  <select
                    value={form.invoice_status_filter}
                    onChange={(e) => setForm((f) => ({ ...f, invoice_status_filter: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    {STATUS_FILTERS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Days lookback
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={form.days_lookback}
                    onChange={(e) => setForm((f) => ({ ...f, days_lookback: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Only send invoices from the last N days
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="gen"
                    checked={form.generate_invoices_before_send}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, generate_invoices_before_send: e.target.checked }))
                    }
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="gen" className="text-sm text-gray-700 dark:text-gray-300">
                    Generate invoices before sending (runs invoice generation for today first)
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
