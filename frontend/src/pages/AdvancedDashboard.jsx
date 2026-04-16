import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
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
  AreaChart,
  Area,
  ComposedChart,
  LineChart as RechartsLineChart,
} from "recharts";
import {
  DollarSign,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Activity,
  Zap,
  Target,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorAlert from "../components/ErrorAlert";
import { dashboardService } from "../services/dashboardService";

// Advanced KPI Card Component
const AdvancedKPICard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "gold",
  trend,
  trendValue,
  bgPattern,
}) => {
  const { isDark } = useTheme();

  const colorClasses = {
    gold: {
      bg: isDark ? "bg-gradient-to-br from-amber-900/30 to-yellow-900/20" : "bg-gradient-to-br from-amber-50 to-yellow-50",
      icon: isDark ? "text-amber-400" : "text-amber-600",
      text: isDark ? "text-amber-300" : "text-amber-600",
      border: isDark ? "border-amber-800/50" : "border-amber-200",
    },
    blue: {
      bg: isDark ? "bg-gradient-to-br from-blue-900/30 to-cyan-900/20" : "bg-gradient-to-br from-blue-50 to-cyan-50",
      icon: isDark ? "text-blue-400" : "text-blue-600",
      text: isDark ? "text-blue-300" : "text-blue-600",
      border: isDark ? "border-blue-800/50" : "border-blue-200",
    },
    green: {
      bg: isDark ? "bg-gradient-to-br from-green-900/30 to-emerald-900/20" : "bg-gradient-to-br from-green-50 to-emerald-50",
      icon: isDark ? "text-green-400" : "text-green-600",
      text: isDark ? "text-green-300" : "text-green-600",
      border: isDark ? "border-green-800/50" : "border-green-200",
    },
    red: {
      bg: isDark ? "bg-gradient-to-br from-red-900/30 to-pink-900/20" : "bg-gradient-to-br from-red-50 to-pink-50",
      icon: isDark ? "text-red-400" : "text-red-600",
      text: isDark ? "text-red-300" : "text-red-600",
      border: isDark ? "border-red-800/50" : "border-red-200",
    },
    purple: {
      bg: isDark ? "bg-gradient-to-br from-indigo-900/30 to-violet-900/20" : "bg-gradient-to-br from-cyan-50 to-violet-50",
      icon: isDark ? "text-cyan-400" : "text-cyan-600",
      text: isDark ? "text-cyan-300" : "text-cyan-600",
      border: isDark ? "border-indigo-800/50" : "border-cyan-200",
    },
  };

  const colors = colorClasses[color] || colorClasses.gold;

  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`
        relative overflow-hidden rounded-2xl border-2 p-6 backdrop-blur-sm
        ${colors.bg} ${colors.border}
        transition-all duration-300 group cursor-pointer
      `}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0 bg-grid-pattern" />
      </div>

      {/* Icon Background */}
      <div className={`absolute top-4 right-4 p-3 rounded-xl ${colors.bg} opacity-50`}>
        <Icon className={`${colors.icon} w-8 h-8`} />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <p className={`text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-600"} mb-1`}>
          {title}
        </p>
        <div className="flex items-end justify-between mb-4">
          <h3 className={`text-3xl sm:text-4xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            {value}
          </h3>
          {trend && (
            <span
              className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                trend === "up"
                  ? isDark
                    ? "bg-green-900/30 text-green-400"
                    : "bg-green-100 text-green-700"
                  : isDark
                  ? "bg-red-900/30 text-red-400"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {trend === "up" ? "↑" : "↓"} {trendValue}
            </span>
          )}
        </div>
        {subtitle && (
          <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Hover Border Animation */}
      <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-opacity-50 transition-all duration-300" />
    </motion.div>
  );
};

// Metric Badge Component
const MetricBadge = ({ label, value, icon: Icon, color = "blue", isDark }) => (
  <div
    className={`flex items-center space-x-2 p-3 rounded-lg ${
      isDark ? "bg-dark-700" : "bg-gray-100"
    }`}
  >
    <Icon className={`w-5 h-5 ${color}`} />
    <div>
      <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
        {label}
      </p>
      <p className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  </div>
);

export default function AdvancedDashboard() {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedMetrics, setExpandedMetrics] = useState({});

  useEffect(() => {
    fetchAnalytics();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchAnalytics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dashboardService.getCompleteAnalytics();
      setAnalytics(data);
    } catch (err) {
      setError(err.message || "Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!analytics) return <ErrorAlert message="No data available" />;

  const formatCurrency = (value) => `৳${Number(value).toLocaleString("en-BD")}`;
  const formatPercent = (value) => `${Number(value).toFixed(2)}%`;

  const tabVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  // Prepare chart data
  const revenueChartData = [
    {
      name: "Daily",
      value: analytics.revenue.daily.total_revenue,
      invoices: analytics.revenue.daily.invoice_count,
    },
    {
      name: "Weekly",
      value: analytics.revenue.weekly.total_revenue,
      invoices: analytics.revenue.weekly.invoice_count,
    },
    {
      name: "Monthly",
      value: analytics.revenue.monthly.total_revenue,
      invoices: analytics.revenue.monthly.invoice_count,
    },
    {
      name: "Yearly",
      value: analytics.revenue.yearly.total_revenue,
      invoices: analytics.revenue.yearly.invoice_count,
    },
  ];

  const customerTypeData = Object.entries(analytics.customer_types).map(
    ([key, value]) => ({
      name: value.customer_type?.toUpperCase() || key,
      value: value.total_customers,
      invoiced: value.total_invoiced,
    })
  );

  const collectionChartData = [
    {
      name: "Daily",
      collected: analytics.collections.daily.total_collected,
      invoiced: analytics.collections.daily.total_invoiced,
      rate: analytics.collections.daily.collection_rate,
    },
    {
      name: "Weekly",
      collected: analytics.collections.weekly.total_collected,
      invoiced: analytics.collections.weekly.total_invoiced,
      rate: analytics.collections.weekly.collection_rate,
    },
    {
      name: "Monthly",
      collected: analytics.collections.monthly.total_collected,
      invoiced: analytics.collections.monthly.total_invoiced,
      rate: analytics.collections.monthly.collection_rate,
    },
  ];

  const kamRevenueData = analytics.kam_performance.monthly
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .map((kam) => ({
      name: kam.kam_name.substring(0, 10),
      revenue: kam.total_revenue,
      customers: kam.customers_count,
    }));

  const colors = {
    primary: "#d4af37",
    secondary: "#00a8e8",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
  };

  const chartColor = (isDark) => ({
    grid: isDark ? "#374151" : "#e5e7eb",
    text: isDark ? "#9ca3af" : "#6b7280",
  });

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? "bg-dark-950" : "bg-gray-50"
      }`}
    >
      {/* Sticky Header */}
      <div
        className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-all duration-300 ${
          isDark
            ? "bg-dark-900/80 border-dark-700"
            : "bg-white/80 border-gold-200"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className={`text-4xl font-bold font-serif ${isDark ? "text-white" : "text-gray-900"}`}>
                Analytics Dashboard
              </h1>
              <p className={`mt-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Real-time business intelligence and KPI tracking
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={fetchAnalytics}
              disabled={loading}
              className={`p-3 rounded-lg font-medium transition-all duration-300 flex items-center space-x-2 ${
                isDark
                  ? "bg-amber-900/50 text-amber-300 hover:bg-amber-800/50"
                  : "bg-amber-100 text-amber-700 hover:bg-amber-200"
              }`}
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

        {/* KPI Cards Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <motion.div variants={itemVariants}>
            <AdvancedKPICard
              title="Weekly Revenue"
              value={formatCurrency(analytics.revenue.weekly.total_revenue)}
              subtitle={`${analytics.revenue.weekly.invoice_count} invoices`}
              icon={DollarSign}
              color="gold"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <AdvancedKPICard
              title="Active Customers"
              value={`${analytics.customers.total_active_customers}/${analytics.customers.total_customers}`}
              subtitle={`${(
                (analytics.customers.total_active_customers / analytics.customers.total_customers) *
                100
              ).toFixed(1)}% active`}
              icon={Users}
              color="blue"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <AdvancedKPICard
              title="Collections"
              value={formatCurrency(analytics.collections.weekly.total_collected)}
              subtitle={`${formatPercent(analytics.collections.weekly.collection_rate)} rate`}
              icon={TrendingUp}
              color="green"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <AdvancedKPICard
              title="Outstanding Due"
              value={formatCurrency(analytics.due.total_due)}
              subtitle={`${analytics.due.invoice_count} invoices`}
              icon={AlertCircle}
              color="red"
            />
          </motion.div>
        </motion.div>

        {/* Engagement & Churn Summary */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
        >
          <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 border-2 ${
              isDark
                ? "bg-dark-800/50 border-indigo-800/50"
                : "bg-cyan-50/50 border-cyan-200"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                Engagement Rate
              </h3>
              <Activity className="w-6 h-6 text-cyan-500" />
            </div>
            <div className="space-y-3">
              <div>
                <p className={`text-4xl font-bold ${isDark ? "text-cyan-300" : "text-cyan-600"}`}>
                  {analytics.engagement.monthly.engagement_ratio.toFixed(2)}%
                </p>
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  {analytics.engagement.monthly.engaged_customers} of{" "}
                  {analytics.engagement.monthly.total_active_customers} customers engaged
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 border-2 ${
              isDark
                ? "bg-dark-800/50 border-red-800/50"
                : "bg-red-50/50 border-red-200"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                Churn Rate
              </h3>
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <div className="space-y-3">
              <div>
                <p className={`text-4xl font-bold ${isDark ? "text-red-300" : "text-red-600"}`}>
                  {analytics.churn.monthly.churn_rate.toFixed(2)}%
                </p>
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  {analytics.churn.monthly.churned_customers} of{" "}
                  {analytics.churn.monthly.total_customers} customers churned
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Charts Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
        >
          {/* Revenue by Period */}
          <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 border-2 ${
              isDark ? "bg-dark-800 border-dark-700" : "bg-white border-gold-100"
            }`}
          >
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
              Revenue by Period
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={revenueChartData}>
                <CartesianGrid stroke={chartColor(isDark).grid} />
                <XAxis stroke={chartColor(isDark).text} />
                <YAxis stroke={chartColor(isDark).text} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#1f2937" : "#ffffff",
                    border: `1px solid ${chartColor(isDark).grid}`,
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar dataKey="value" fill={colors.primary} name="Revenue" radius={[8, 8, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="invoices"
                  stroke={colors.secondary}
                  name="Invoices"
                  yAxisId="right"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Customer Types Distribution */}
          <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 border-2 ${
              isDark ? "bg-dark-800 border-dark-700" : "bg-white border-gold-100"
            }`}
          >
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
              Customer Types
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={customerTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill={colors.primary} />
                  <Cell fill={colors.secondary} />
                  <Cell fill={colors.success} />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Collections vs Invoiced */}
          <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 border-2 ${
              isDark ? "bg-dark-800 border-dark-700" : "bg-white border-gold-100"
            }`}
          >
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
              Collections vs Invoiced
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={collectionChartData}>
                <CartesianGrid stroke={chartColor(isDark).grid} />
                <XAxis stroke={chartColor(isDark).text} />
                <YAxis stroke={chartColor(isDark).text} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#1f2937" : "#ffffff",
                    border: `1px solid ${chartColor(isDark).grid}`,
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar dataKey="collected" fill={colors.success} name="Collected" radius={[8, 8, 0, 0]} />
                <Bar dataKey="invoiced" fill={colors.warning} name="Invoiced" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Top KAM Performance */}
          <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 border-2 ${
              isDark ? "bg-dark-800 border-dark-700" : "bg-white border-gold-100"
            }`}
          >
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
              Top KAM Performance
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={kamRevenueData} layout="vertical">
                <CartesianGrid stroke={chartColor(isDark).grid} />
                <XAxis type="number" stroke={chartColor(isDark).text} />
                <YAxis dataKey="name" type="category" stroke={chartColor(isDark).text} width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#1f2937" : "#ffffff",
                    border: `1px solid ${chartColor(isDark).grid}`,
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="revenue" fill={colors.primary} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </motion.div>

        {/* Detailed Tables */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Top Customers Table */}
          <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 border-2 overflow-hidden ${
              isDark ? "bg-dark-800 border-dark-700" : "bg-white border-gold-100"
            }`}
          >
            <h3 className={`text-lg font-semibold mb-6 ${isDark ? "text-white" : "text-gray-900"}`}>
              Top Customers by Invoice Amount
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className={`border-b ${
                      isDark ? "border-dark-700" : "border-gold-100"
                    }`}
                  >
                    <th
                      className={`px-4 py-3 text-left font-semibold ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Customer
                    </th>
                    <th
                      className={`px-4 py-3 text-center font-semibold ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Type
                    </th>
                    <th
                      className={`px-4 py-3 text-right font-semibold ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Invoiced
                    </th>
                    <th
                      className={`px-4 py-3 text-right font-semibold ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Collected
                    </th>
                    <th
                      className={`px-4 py-3 text-right font-semibold ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Outstanding
                    </th>
                    <th
                      className={`px-4 py-3 text-center font-semibold ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Collection %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.collections.by_customer
                    .filter((c) => c.total_invoiced > 0)
                    .sort((a, b) => b.total_invoiced - a.total_invoiced)
                    .slice(0, 10)
                    .map((customer, idx) => (
                      <tr
                        key={idx}
                        className={`border-b transition-colors ${
                          isDark
                            ? "border-dark-700 hover:bg-dark-700/50"
                            : "border-gold-100 hover:bg-gold-50"
                        }`}
                      >
                        <td className={`px-4 py-3 font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                          {customer.customer_name}
                        </td>
                        <td className={`px-4 py-3 text-center text-xs font-semibold`}>
                          <span
                            className={`px-2 py-1 rounded ${
                              customer.customer_type === "bw"
                                ? isDark
                                  ? "bg-blue-900/50 text-blue-300"
                                  : "bg-blue-100 text-blue-700"
                                : customer.customer_type === "soho"
                                ? isDark
                                  ? "bg-indigo-900/50 text-cyan-300"
                                  : "bg-cyan-100 text-cyan-700"
                                : isDark
                                ? "bg-green-900/50 text-green-300"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {customer.customer_type === "bw"
                              ? "BW"
                              : customer.customer_type === "soho"
                              ? "SOHO"
                              : "OTHER"}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                          {formatCurrency(customer.total_invoiced)}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${isDark ? "text-green-400" : "text-green-600"}`}>
                          {formatCurrency(customer.total_collected)}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${isDark ? "text-red-400" : "text-red-600"}`}>
                          {formatCurrency(customer.outstanding_balance)}
                        </td>
                        <td className={`px-4 py-3 text-center ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                          {formatPercent(customer.collection_rate)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* KAM Performance Table */}
          <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 border-2 overflow-hidden ${
              isDark ? "bg-dark-800 border-dark-700" : "bg-white border-gold-100"
            }`}
          >
            <h3 className={`text-lg font-semibold mb-6 ${isDark ? "text-white" : "text-gray-900"}`}>
              KAM Performance Metrics
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className={`border-b ${
                      isDark ? "border-dark-700" : "border-gold-100"
                    }`}
                  >
                    <th
                      className={`px-4 py-3 text-left font-semibold ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      KAM Name
                    </th>
                    <th
                      className={`px-4 py-3 text-center font-semibold ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Total Customers
                    </th>
                    <th
                      className={`px-4 py-3 text-center font-semibold ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Invoices
                    </th>
                    <th
                      className={`px-4 py-3 text-right font-semibold ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Total Revenue
                    </th>
                    <th
                      className={`px-4 py-3 text-right font-semibold ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Collected
                    </th>
                    <th
                      className={`px-4 py-3 text-center font-semibold ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Collection %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.kam_performance.monthly
                    .sort((a, b) => b.total_revenue - a.total_revenue)
                    .map((kam, idx) => (
                      <tr
                        key={idx}
                        className={`border-b transition-colors ${
                          isDark
                            ? "border-dark-700 hover:bg-dark-700/50"
                            : "border-gold-100 hover:bg-gold-50"
                        }`}
                      >
                        <td className={`px-4 py-3 font-semibold ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                          {kam.kam_name}
                        </td>
                        <td className={`px-4 py-3 text-center ${isDark ? "text-white" : "text-gray-900"}`}>
                          {kam.customers_count}
                        </td>
                        <td className={`px-4 py-3 text-center ${isDark ? "text-white" : "text-gray-900"}`}>
                          {kam.invoices_count}
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                          {formatCurrency(kam.total_revenue)}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${isDark ? "text-green-400" : "text-green-600"}`}>
                          {formatCurrency(kam.total_collected)}
                        </td>
                        <td className={`px-4 py-3 text-center ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                          {formatPercent(kam.collection_rate)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Customer Type Summary */}
          <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 border-2 ${
              isDark ? "bg-dark-800 border-dark-700" : "bg-white border-gold-100"
            }`}
          >
            <h3 className={`text-lg font-semibold mb-6 ${isDark ? "text-white" : "text-gray-900"}`}>
              Customer Type Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(analytics.customer_types).map(([key, type]) => (
                <div
                  key={key}
                  className={`p-4 rounded-lg border-2 ${
                    isDark
                      ? "bg-dark-700/50 border-dark-600"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <h4 className={`font-semibold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
                    {type.customer_type?.toUpperCase()}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p className={isDark ? "text-gray-400" : "text-gray-600"}>
                      Total:{" "}
                      <span className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                        {type.total_customers}
                      </span>
                    </p>
                    <p className={isDark ? "text-gray-400" : "text-gray-600"}>
                      Active:{" "}
                      <span className={`font-bold ${isDark ? "text-green-400" : "text-green-600"}`}>
                        {type.active_customers}
                      </span>
                    </p>
                    <p className={isDark ? "text-gray-400" : "text-gray-600"}>
                      Invoiced:{" "}
                      <span className={`font-bold ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                        {formatCurrency(type.total_invoiced)}
                      </span>
                    </p>
                    <p className={isDark ? "text-gray-400" : "text-gray-600"}>
                      Collection:{" "}
                      <span className={`font-bold ${isDark ? "text-blue-400" : "text-blue-600"}`}>
                        {formatPercent(type.collection_rate)}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
