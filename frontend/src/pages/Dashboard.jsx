import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  DollarSign,
  Users,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorAlert from "../components/ErrorAlert";
import { dashboardService } from "../services/dashboardService";
import { customerService } from "../services/customerService";
import { APP_TITLE, APP_DESCRIPTION } from "../constants/branding";

// KPI Card Component
const KPICard = ({ title, value, icon: Icon, color, trend, trendValue }) => {
  const { isDark } = useTheme();

  const colorMap = {
    gold: { bg: isDark ? "from-yellow-900/20 to-amber-900/20" : "from-yellow-50 to-amber-50", icon: "text-yellow-500", border: "border-yellow-200" },
    blue: { bg: isDark ? "from-blue-900/20 to-cyan-900/20" : "from-blue-50 to-cyan-50", icon: "text-blue-500", border: "border-blue-200" },
    green: { bg: isDark ? "from-green-900/20 to-emerald-900/20" : "from-green-50 to-emerald-50", icon: "text-green-500", border: "border-green-200" },
    purple: { bg: isDark ? "from-indigo-900/20 to-violet-900/20" : "from-cyan-50 to-violet-50", icon: "text-cyan-500", border: "border-cyan-200" },
    red: { bg: isDark ? "from-red-900/20 to-rose-900/20" : "from-red-50 to-rose-50", icon: "text-red-500", border: "border-red-200" },
  };

  const colors = colorMap[color] || colorMap.gold;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`bg-gradient-to-br ${colors.bg} border-2 ${colors.border} rounded-xl p-6`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-600"} mb-2`}>{title}</p>
          <h3 className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            {typeof value === "string" ? value : `৳${value?.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
          </h3>
          {trendValue && (
            <p className={`text-xs mt-2 ${trend === "up" ? "text-green-600" : "text-red-600"}`}>
              {trend === "up" ? "▲" : "▼"} {trendValue}
            </p>
          )}
        </div>
        <div className={`${colors.icon} p-3 bg-white/20 rounded-lg`}>
          <Icon size={24} />
        </div>
      </div>
    </motion.div>
  );
};

// Main Dashboard
export default function Dashboard() {
  const { isDark } = useTheme();
  const [analytics, setAnalytics] = useState(null);
  const [customerStats, setCustomerStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCustomerStats = async () => {
    try {
      const [allRes, activeRes] = await Promise.all([
        customerService.getAllCustomers({ limit: 1, offset: 0 }),
        customerService.getAllCustomers({ limit: 1, offset: 0, status: "active" }),
      ]);
      const total = allRes && typeof allRes.count === "number" ? allRes.count : 0;
      const active = activeRes && typeof activeRes.count === "number" ? activeRes.count : 0;
      setCustomerStats({ totalCustomers: total, activeCustomers: active });
    } catch {
      setCustomerStats((prev) => ({ ...prev }));
    }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchCustomerStats();
    const interval = setInterval(() => {
      fetchAnalytics();
      fetchCustomerStats();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchAnalytics = async () => {
    try {
      setError(null);
      const data = await dashboardService.getCompleteAnalytics();
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} onRetry={fetchAnalytics} />;
  if (!analytics) return <div>No data available</div>;

  // Prepare chart data (use safe defaults)
  const revenueData = [
    { period: "Daily", revenue: analytics.revenue?.daily?.total_revenue || 0 },
    { period: "Weekly", revenue: analytics.revenue?.weekly?.total_revenue || 0 },
    { period: "Monthly", revenue: analytics.revenue?.monthly?.total_revenue || 0 },
    { period: "Yearly", revenue: analytics.revenue?.yearly?.total_revenue || 0 },
  ];

  const customerTypeData = Object.entries(analytics.customer_types || {}).map(([key, data]) => ({
    name:
      data?.customer_type === "bw"
        ? "BW"
        : data?.customer_type === "soho"
        ? "SOHO"
        : "Other",
    value: data?.total_customers || 0,
    invoiced: data?.total_invoiced || 0,
  }));

  const collectionData = [
    { name: "Collected", value: analytics.collections?.total_collected?.total_collected || 0 },
    { name: "Due", value: analytics.due?.total_due || 0 },
  ];

  const kamTopPerformers = (analytics.kam_performance?.monthly || [])
    .slice() // copy
    .sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))
    .slice(0, 5);

  const COLORS = ["#fbbf24", "#3b82f6", "#8b5cf6"];

  // Top 10 customers by invoice
  const topCustomers = (analytics.collections?.by_customer || [])
    .slice()
    .sort((a, b) => (b.total_invoiced || 0) - (a.total_invoiced || 0))
    .slice(0, 10);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? "bg-dark-950" : "bg-gray-50"}`}>
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-4">
        <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
          {APP_TITLE}
        </h1>
        <p className={`mt-1 text-sm ${isDark ? "text-silver-400" : "text-gray-500"}`}>
          {APP_DESCRIPTION}
        </p>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12">

      {/* KPI Cards - Top Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        <KPICard
          title="Total Revenue"
          value={analytics.revenue?.weekly?.total_revenue || 0}
          icon={DollarSign}
          color="gold"
          trendValue="↑ 12.5% vs last month"
        />
        <KPICard
          title="Total Customers"
          value={String(customerStats.totalCustomers)}
          icon={Users}
          color="blue"
        />
        <KPICard
          title="Active Customers"
          value={String(customerStats.activeCustomers)}
          icon={TrendingUp}
          color="green"
        />
        <KPICard
          title="Collection Rate"
          value={`${(analytics.collections?.weekly?.collection_rate || 0).toFixed(1)}%`}
          icon={AlertCircle}
          color="purple"
          trendValue="↓ 3.2% vs last month"
        />
      </motion.div>

      {/* Second Row - Total Due */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <KPICard
          title="Total Due"
          value={analytics.due?.total_due || 0}
          icon={AlertCircle}
          color="red"
          trendValue="↑ 3.1% vs last month"
        />
      </motion.div>

      {/* Charts Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
      >
        {/* Monthly Revenue Chart */}
        <div className={`${isDark ? "bg-dark-800" : "bg-white"} rounded-xl p-6 border ${isDark ? "border-dark-700" : "border-gray-200"}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>Monthly Revenue</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
              <XAxis dataKey="period" stroke={isDark ? "#9ca3af" : "#6b7280"} />
              <YAxis stroke={isDark ? "#9ca3af" : "#6b7280"} />
              <Tooltip contentStyle={{ backgroundColor: isDark ? "#1f2937" : "#fff", border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}` }} />
              <Bar dataKey="revenue" fill="#d4af37" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Status Distribution */}
        <div className={`${isDark ? "bg-dark-800" : "bg-white"} rounded-xl p-6 border ${isDark ? "border-dark-700" : "border-gray-200"}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>Customer Status Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={[
                  { name: "Active", value: analytics.customers?.customer_status?.active?.count || 0 },
                  { name: "Inactive", value: analytics.customers?.customer_status?.inactive?.count || 0 },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={110}
                dataKey="value"
              >
                {[0, 1].map((index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* KAM Performance & Top Customers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
      >
        {/* KAM Performance */}
        <div className={`${isDark ? "bg-dark-800" : "bg-white"} rounded-xl p-6 border ${isDark ? "border-dark-700" : "border-gray-200"}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>KAM Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart layout="vertical" data={kamTopPerformers}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
              <XAxis type="number" stroke={isDark ? "#9ca3af" : "#6b7280"} />
              <YAxis dataKey="kam_name" type="category" width={100} stroke={isDark ? "#9ca3af" : "#6b7280"} fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: isDark ? "#1f2937" : "#fff", border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}` }} />
              <Bar dataKey="total_revenue" fill="#3b82f6" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Collections vs Invoiced */}
        <div className={`${isDark ? "bg-dark-800" : "bg-white"} rounded-xl p-6 border ${isDark ? "border-dark-700" : "border-gray-200"}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>Collections Overview</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={collectionData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
              <XAxis dataKey="name" stroke={isDark ? "#9ca3af" : "#6b7280"} />
              <YAxis stroke={isDark ? "#9ca3af" : "#6b7280"} />
              <Tooltip contentStyle={{ backgroundColor: isDark ? "#1f2937" : "#fff", border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}` }} />
              <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Tables Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
      >
        {/* Top Customers Table */}
        <div className={`${isDark ? "bg-dark-800" : "bg-white"} rounded-xl p-6 border ${isDark ? "border-dark-700" : "border-gray-200"}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>Top Customers by Revenue</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}>
                  <th className={`text-left py-3 px-3 font-semibold ${isDark ? "text-gray-300" : "text-gray-600"}`}>Customer Name</th>
                  <th className={`text-right py-3 px-3 font-semibold ${isDark ? "text-gray-300" : "text-gray-600"}`}>Revenue</th>
                  <th className={`text-right py-3 px-3 font-semibold ${isDark ? "text-gray-300" : "text-gray-600"}`}>Collection %</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((customer, idx) => {
                  const invoiced = Number(customer.total_invoiced) || 0;
                  const collectionRate = Number(customer.collection_rate) || 0;
                  return (
                    <tr key={idx} className={`border-b transition-colors ${isDark ? "border-dark-700/50 hover:bg-dark-700/50" : "border-gray-100 hover:bg-gray-50"}`}>
                      <td className={`py-3 px-3 ${isDark ? "text-gray-300" : "text-gray-700"}`}>{customer.customer_name}</td>
                      <td className={`py-3 px-3 text-right font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>৳{invoiced.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
                      <td className={`py-3 px-3 text-right ${collectionRate > 50 ? "text-green-500" : "text-yellow-500"}`}>{collectionRate.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* KAM Summary Table */}
        <div className={`${isDark ? "bg-dark-800" : "bg-white"} rounded-xl p-6 border ${isDark ? "border-dark-700" : "border-gray-200"}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>KAM Performance Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}>
                  <th className={`text-left py-3 px-3 font-semibold ${isDark ? "text-gray-300" : "text-gray-600"}`}>KAM Name</th>
                  <th className={`text-center py-3 px-3 font-semibold ${isDark ? "text-gray-300" : "text-gray-600"}`}>Customers</th>
                  <th className={`text-right py-3 px-3 font-semibold ${isDark ? "text-gray-300" : "text-gray-600"}`}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(analytics.kam_performance?.monthly || []).map((kam, idx) => {
                  const totalRevenue = Number(kam.total_revenue) || 0;
                  const customersCount = kam.customers_count || 0;
                  return (
                    <tr key={idx} className={`border-b transition-colors ${isDark ? "border-dark-700/50 hover:bg-dark-700/50" : "border-gray-100 hover:bg-gray-50"}`}>
                      <td className={`py-3 px-3 ${isDark ? "text-gray-300" : "text-gray-700"}`}>{kam.kam_name}</td>
                      <td className={`py-3 px-3 text-center ${isDark ? "text-white" : "text-gray-900"}`}>{customersCount}</td>
                      <td className={`py-3 px-3 text-right font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>৳{totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Metrics Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {/* Engagement */}
        <div className={`${isDark ? "bg-dark-800" : "bg-white"} rounded-xl p-6 border ${isDark ? "border-dark-700" : "border-gray-200"}`}>
          <h3 className={`text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-600"}`}>Engagement Rate</h3>
          <p className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{((analytics.engagement?.weekly?.engagement_ratio) || 0).toFixed(2)}%</p>
          <p className={`text-xs mt-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>{analytics.engagement?.weekly?.engaged_customers || 0} of {analytics.engagement?.weekly?.total_active_customers || 0} customers</p>
        </div>

        {/* Churn */}
        <div className={`${isDark ? "bg-dark-800" : "bg-white"} rounded-xl p-6 border ${isDark ? "border-dark-700" : "border-gray-200"}`}>
          <h3 className={`text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-600"}`}>Monthly Churn Rate</h3>
          <p className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{((analytics.churn?.monthly?.churn_rate) || 0).toFixed(2)}%</p>
          <p className={`text-xs mt-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>{analytics.churn?.monthly?.churned_customers || 0} of {analytics.churn?.monthly?.total_customers || 0} customers</p>
        </div>

        {/* Outstanding Invoices */}
        <div className={`${isDark ? "bg-dark-800" : "bg-white"} rounded-xl p-6 border ${isDark ? "border-dark-700" : "border-gray-200"}`}>
          <h3 className={`text-sm font-semibold mb-2 ${isDark ? "text-silver-300" : "text-gray-600"}`}>Outstanding Invoices</h3>
          <p className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{analytics.due?.invoice_count || 0}</p>
          <p className={`text-xs mt-2 ${isDark ? "text-silver-400" : "text-gray-500"}`}>Overdue: {analytics.due?.overdue_count || 0}</p>
        </div>
      </motion.div>
      </div>
    </div>
  );
}
