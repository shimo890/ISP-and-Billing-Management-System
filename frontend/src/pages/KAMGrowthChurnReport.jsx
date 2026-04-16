import React, { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshCw } from "lucide-react";
import api from "../services/api";
import PageLayout from "../components/PageLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorAlert from "../components/ErrorAlert";
import { kamReportService } from "../services/kamReportService";
import { APP_TITLE } from "../constants/branding";

const PERIODS = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom range" },
];

function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(n));
}

export default function KAMGrowthChurnReport() {
  const [kamList, setKamList] = useState([]);
  const [kamId, setKamId] = useState("");
  const [period, setPeriod] = useState("monthly");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingKams, setLoadingKams] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await api.get("/customers/kam/");
        const list = Array.isArray(raw)
          ? raw
          : raw?.results ?? raw?.data ?? [];
        if (!cancelled) {
          setKamList(list);
          if (list.length && !kamId) {
            setKamId(String(list[0].id));
          }
        }
      } catch (e) {
        if (!cancelled) setKamList([]);
      } finally {
        if (!cancelled) setLoadingKams(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadReport = useCallback(async () => {
    if (!kamId) {
      setError("Select a KAM (account manager).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = {
        kam_id: kamId,
        period,
      };
      if (period === "custom") {
        if (!fromDate || !toDate) {
          setError("For custom range, select both From and To dates.");
          setLoading(false);
          return;
        }
        params.from_date = fromDate;
        params.to_date = toDate;
      }
      const payload = await kamReportService.getKamGrowthChurn(params);
      setData(payload);
    } catch (e) {
      setData(null);
      setError(e?.message || "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }, [kamId, period, fromDate, toDate]);

  useEffect(() => {
    if (!kamId || loadingKams) return;
    if (period === "custom" && (!fromDate || !toDate)) return;
    loadReport();
  }, [kamId, period, fromDate, toDate, loadingKams, loadReport]);

  const chartRows = data?.charts?.monthly ?? [];
  const grand = data?.grand_totals;

  return (
    <PageLayout
      title="KAM onboarding & churn"
      subtitle={`${APP_TITLE} — new billing (MRC) vs subscriber loss by period`}
      actions={
        <button
          type="button"
          onClick={() => loadReport()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-sm hover:opacity-95 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-6">
        {loadingKams ? (
          <LoadingSpinner message="Loading KAM list…" />
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 p-4 sm:p-6 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-600 dark:text-slate-400">KAM</span>
                <select
                  value={kamId}
                  onChange={(e) => setKamId(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
                >
                  <option value="">—</option>
                  {kamList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.kam_name || k.name || `KAM #${k.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-600 dark:text-slate-400">Period</span>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
                >
                  {PERIODS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              {period === "custom" && (
                <>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-600 dark:text-slate-400">From</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-600 dark:text-slate-400">To</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        )}

        {error && <ErrorAlert message={error} />}

        {loading && !data && <LoadingSpinner message="Loading report…" />}

        {data && !error && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  New MRC (onboarding)
                </p>
                <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatMoney(grand?.performance?.total_sales_mrc)}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {grand?.onboarding?.customer_count ?? 0} subscribers
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Revenue at risk (churn)
                </p>
                <p className="text-2xl font-semibold text-rose-600 dark:text-rose-400 mt-1">
                  {formatMoney(grand?.performance?.total_loss_mrc)}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {grand?.termination?.customer_count ?? 0} terminations
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Net MRC movement
                </p>
                <p className="text-2xl font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                  {formatMoney(grand?.performance?.net_growth_mrc)}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {data.kam_name ? `KAM: ${data.kam_name}` : ""}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-4 sm:p-6 shadow-sm h-[380px] min-w-0">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">
                New MRC vs loss by month
              </h3>
              {chartRows.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-sm">No chart data in range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartRows}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month_label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => formatMoney(v)} />
                    <Legend />
                    <Bar dataKey="sales_mrc" name="New MRC" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="loss_mrc" name="Loss MRC" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Period buckets
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-600 dark:text-slate-400">
                      <th className="px-4 py-3">Bucket</th>
                      <th className="px-4 py-3">New subs</th>
                      <th className="px-4 py-3">New MRC</th>
                      <th className="px-4 py-3">Churned</th>
                      <th className="px-4 py-3">Loss MRC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.buckets || []).map((b) => (
                      <tr
                        key={b.key || b.label}
                        className="border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                      >
                        <td className="px-4 py-2">{b.label}</td>
                        <td className="px-4 py-2">{b.new_totals?.customer_count ?? 0}</td>
                        <td className="px-4 py-2">{formatMoney(b.new_totals?.total_mrc)}</td>
                        <td className="px-4 py-2">{b.termination_totals?.customer_count ?? 0}</td>
                        <td className="px-4 py-2">
                          {formatMoney(b.termination_totals?.total_revenue_loss)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
