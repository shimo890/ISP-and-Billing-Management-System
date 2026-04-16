import React, { useEffect, useMemo, useState } from "react";
import PageLayout from "../components/PageLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorAlert from "../components/ErrorAlert";
import { useAuth } from "../context/AuthContext";
import { kamService } from "../services/kamService";

const initialForm = {
  kam_name: "",
  designation: "",
  phone: "",
  email: "",
  address: "",
  is_active: true,
};

export default function KAMManagement({ defaultMode = "list" }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("customers:update") || hasPermission("all");
  const [mode, setMode] = useState(defaultMode);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await kamService.list({ search });
      setItems(Array.isArray(data) ? data : data?.results || []);
    } catch (e) {
      setError(e?.message || "Failed to load KAM list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const title = useMemo(
    () => (mode === "create" ? "KAM - Create" : "KAM - List"),
    [mode]
  );

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await kamService.update(editingId, form);
      } else {
        await kamService.create(form);
      }
      setForm(initialForm);
      setEditingId(null);
      setMode("list");
      await load();
    } catch (e2) {
      setError(e2?.message || "Failed to save KAM.");
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (row) => {
    if (!canManage) return;
    setEditingId(row.id);
    setForm({
      kam_name: row.kam_name || "",
      designation: row.designation || "",
      phone: row.phone || "",
      email: row.email || "",
      address: row.address || "",
      is_active: !!row.is_active,
    });
    setMode("create");
  };

  const onDelete = async (id) => {
    if (!canManage) return;
    if (!window.confirm("Delete this KAM?")) return;
    try {
      await kamService.remove(id);
      await load();
    } catch (e) {
      setError(e?.message || "Failed to delete KAM.");
    }
  };

  return (
    <PageLayout
      title={title}
      subtitle="Manage key account managers and assignment source data"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("create")}
            disabled={!canManage}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 text-white disabled:opacity-50"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setMode("list")}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
          >
            List
          </button>
        </div>
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-4">
        {error && <ErrorAlert message={error} />}

        {mode === "create" && (
          <form
            onSubmit={onSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900"
          >
            <input
              value={form.kam_name}
              onChange={(e) => setForm((p) => ({ ...p, kam_name: e.target.value }))}
              required
              placeholder="KAM name"
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
            />
            <input
              value={form.designation}
              onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))}
              placeholder="Designation"
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="Phone"
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="Email"
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
            />
            <textarea
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="Address"
              rows={3}
              className="md:col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
              />
              Active
            </label>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={saving || !canManage}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Update KAM" : "Create KAM"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(initialForm);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        )}

        {mode === "list" && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search KAM..."
                className="w-full md:w-96 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
              <button
                type="button"
                onClick={load}
                className="ml-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
              >
                Search
              </button>
            </div>
            {loading ? (
              <div className="p-6">
                <LoadingSpinner message="Loading KAM list..." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Designation</th>
                      <th className="px-4 py-3 text-left">Phone</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="px-4 py-2">{row.kam_name}</td>
                        <td className="px-4 py-2">{row.designation || "-"}</td>
                        <td className="px-4 py-2">{row.phone || "-"}</td>
                        <td className="px-4 py-2">{row.email || "-"}</td>
                        <td className="px-4 py-2">{row.is_active ? "Active" : "Inactive"}</td>
                        <td className="px-4 py-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => onEdit(row)}
                              disabled={!canManage}
                              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(row.id)}
                              disabled={!canManage}
                              className="px-2 py-1 rounded border border-rose-300 text-rose-600 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                          No KAM records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
