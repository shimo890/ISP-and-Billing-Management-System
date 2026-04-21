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
} from "recharts";
import {
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Filter,
  RefreshCw,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorAlert from "../components/ErrorAlert";
import { dashboardService } from "../services/dashboardService";

export default function Dashboard() {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState("month");

  // KPI Data
  const [kpiData, setKpiData] = useState({
    totalRevenue: 0,
    totalCustomers: 0,
    activeCustomers: 0,
    collectionRate: 0,
    totalDue: 0,
  });

  // Chart Data
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [yearlyData, setYearlyData] = useState([]);
  const [customerWiseData, setCustomerWiseData] = useState([]);
  const [kamPerformanceData, setKamPerformanceData] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all analytics data
      const [weeklyRes, monthlyRes, yearlyRes, customerWiseRes] =
        await Promise.all([
          dashboardService.getWeeklyRevenue(),
          dashboardService.getMonthlyRevenue(),
          dashboardService.getYearlyRevenue(),
          dashboardService.getCustomerWiseRevenue(),
        ]);

      const weekly = weeklyRes.data || weeklyRes;
      const monthly = monthlyRes.data || monthlyRes;
      const yearly = yearlyRes.data || yearlyRes;
      const customerWise = customerWiseRes.data || customerWiseRes;

      setWeeklyData(weekly);
      setMonthlyData(monthly);
      setYearlyData(yearly);
      setCustomerWiseData(customerWise);

      // Calculate KAM Performance
      const kamMap = {};
      customerWise.forEach((customer) => {
        if (customer.kam) {
          if (!kamMap[customer.kam]) {
            kamMap[customer.kam] = {
              kam: customer.kam,
              customers: 0,
              totalRevenue: 0,
              activeCustomers: 0,
            };
          }
          kamMap[customer.kam].customers += 1;
          kamMap[customer.kam].totalRevenue += customer.totalRevenue || 0;
          if (customer.status === 'Active') {
            kamMap[customer.kam].activeCustomers += 1;
          }
        }
      });
      const kamPerformance = Object.values(kamMap).sort(
        (a, b) => b.totalRevenue - a.totalRevenue
      );
      setKamPerformanceData(kamPerformance);

      // Calculate KPIs
      const totalRevenue = monthly.reduce(
        (sum, item) => sum + (item.revenue || 0),
        0
      );
      const totalCustomers = customerWise.length;
      const activeCustomers = customerWise.filter((c) => c.status === 'Active').length;
      const collectionRate =
        customerWise.length > 0
          ? (
              (customerWise.filter((c) => c.collectionRate > 0).length /
                customerWise.length) *
              100
            ).toFixed(1)
          : 0;
      const totalDue = customerWise.reduce(
        (sum, c) => sum + (c.totalDue || 0),
        0
      );

      setKpiData({
        totalRevenue: totalRevenue.toLocaleString("en-US", {
          maximumFractionDigits: 0,
        }),
        totalCustomers,
        activeCustomers,
        collectionRate: `${collectionRate}%`,
        totalDue: totalDue.toLocaleString("en-US", {
          maximumFractionDigits: 0,
        }),
      });
    } catch (err) {
      setError(err.message || "Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const chartColors = {
    primary: isDark ? "#d4af37" : "#d4af37",
    secondary: isDark ? "#00a8e8" : "#0066cc",
    success: isDark ? "#10b981" : "#10b981",
    warning: isDark ? "#f59e0b" : "#f59e0b",
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

  if (loading) return <LoadingSpinner />;

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? "bg-dark-950" : "bg-gray-50"
      }`}
    >
      {/* Header */}
      <div
        className={`sticky top-0 z-40 backdrop-blur-md border-b transition-all duration-300 ${
          isDark
            ? "bg-dark-900/80 border-dark-700"
            : "bg-white/80 border-gold-100"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1
                className={`text-3xl sm:text-4xl font-serif font-bold ${
                  isDark ? "text-white" : "text-dark-900"
                }`}
              >
                ISP Billing & Customer Management
              </h1>
              <p
                className={`mt-2 ${
                  isDark ? "text-silver-400" : "text-gray-600"
                }`}
              >
                Bandwidth billing overview
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={fetchDashboardData}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  isDark
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                <RefreshCw size={20} />
              </motion.button>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className={`px-4 py-2 pe-8 rounded-lg font-medium transition-all duration-300 border ${
                  isDark
                    ? "bg-dark-800 border-dark-700 text-blue-400 hover:border-blue-500"
                    : "bg-white border-blue-200 text-blue-600 hover:border-blue-400"
                }`}
              >
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

        {/* KPI Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <motion.div variants={itemVariants}>
            <KPICard
              title="Total Revenue"
              value={`৳${kpiData.totalRevenue}`}
              icon={DollarSign}
              color="gold"
              trend="up"
              trendValue="+12.5%"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KPICard
              title="Total Customers"
              value={kpiData.totalCustomers}
              icon={Users}
              color="blue"
              trend="up"
              trendValue="+8.2%"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KPICard
              title="Active Customers"
              value={kpiData.activeCustomers}
              icon={TrendingUp}
              color="green"
              trend="up"
              trendValue="+5.1%"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KPICard
              title="Collection Rate"
              value={kpiData.collectionRate}
              icon={Calendar}
              color="purple"
              trend="up"
              trendValue="+3.2%"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KPICard
              title="Total Due"
              value={`৳${kpiData.totalDue}`}
              icon={TrendingDown}
              color="red"
              trend="down"
              trendValue="-2.1%"
            />
          </motion.div>
        </motion.div>

        {/* Charts Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
        >
          {/* Weekly Revenue Chart */}
          {dateRange === 'week' && (
            <motion.div
              variants={itemVariants}
              className={`rounded-2xl p-6 transition-all duration-300 ${
                isDark
                  ? "bg-dark-800 border border-dark-700"
                  : "bg-white border border-gold-100"
              }`}
            >
              <h3
                className={`text-lg font-semibold mb-4 ${
                  isDark ? "text-white" : "text-dark-900"
                }`}
              >
                Weekly Revenue
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={chartColors.primary}
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="95%"
                        stopColor={chartColors.primary}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#374151" : "#e5e7eb"}
                  />
                  <XAxis stroke={isDark ? "#9ca3af" : "#6b7280"} />
                  <YAxis stroke={isDark ? "#9ca3af" : "#6b7280"} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? "#1f2937" : "#ffffff",
                      border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: isDark ? "#d4af37" : "#d4af37" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={chartColors.primary}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Monthly Revenue Chart */}
          {dateRange === 'month' && (
            <motion.div
              variants={itemVariants}
              className={`rounded-2xl p-6 transition-all duration-300 ${
                isDark
                  ? "bg-dark-800 border border-dark-700"
                  : "bg-white border border-gold-100"
              }`}
            >
              <h3
                className={`text-lg font-semibold mb-4 ${
                  isDark ? "text-white" : "text-dark-900"
                }`}
              >
                Monthly Revenue
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#374151" : "#e5e7eb"}
                  />
                  <XAxis stroke={isDark ? "#9ca3af" : "#6b7280"} />
                  <YAxis stroke={isDark ? "#9ca3af" : "#6b7280"} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? "#1f2937" : "#ffffff",
                      border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: isDark ? "#d4af37" : "#d4af37" }}
                  />
                  <Bar
                    dataKey="revenue"
                    fill={chartColors.primary}
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Yearly Revenue Chart */}
          {dateRange === 'year' && (
            <motion.div
              variants={itemVariants}
              className={`rounded-2xl p-6 transition-all duration-300 ${
                isDark
                  ? "bg-dark-800 border border-dark-700"
                  : "bg-white border border-gold-100"
              }`}
            >
              <h3
                className={`text-lg font-semibold mb-4 ${
                  isDark ? "text-white" : "text-dark-900"
                }`}
              >
                Yearly Revenue
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={yearlyData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#374151" : "#e5e7eb"}
                  />
                  <XAxis stroke={isDark ? "#9ca3af" : "#6b7280"} />
                  <YAxis stroke={isDark ? "#9ca3af" : "#6b7280"} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? "#1f2937" : "#ffffff",
                      border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: isDark ? "#d4af37" : "#d4af37" }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke={chartColors.primary}
                    strokeWidth={2}
                    dot={{ fill: chartColors.primary }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Customer Distribution */}
          <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 transition-all duration-300 ${
              isDark
                ? "bg-dark-800 border border-dark-700"
                : "bg-white border border-gold-100"
            }`}
          >
            <h3
              className={`text-lg font-semibold mb-4 ${
                isDark ? "text-white" : "text-dark-900"
              }`}
            >
              Customer Status Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Active", value: kpiData.activeCustomers },
                    {
                      name: "Inactive/Lost",
                      value: kpiData.totalCustomers - kpiData.activeCustomers,
                    },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill={chartColors.success} />
                  <Cell fill={chartColors.warning} />
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#1f2937" : "#ffffff",
                    border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>

          {/* KAM Performance Chart */}
          <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 transition-all duration-300 ${
              isDark
                ? "bg-dark-800 border border-dark-700"
                : "bg-white border border-gold-100"
            }`}
          >
            <h3
              className={`text-lg font-semibold mb-4 ${
                isDark ? "text-white" : "text-dark-900"
              }`}
            >
              KAM Performance
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={kamPerformanceData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? "#374151" : "#e5e7eb"}
                />
                <XAxis dataKey="kam" stroke={isDark ? "#9ca3af" : "#6b7280"} />
                <YAxis stroke={isDark ? "#9ca3af" : "#6b7280"} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#1f2937" : "#ffffff",
                    border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: isDark ? "#d4af37" : "#d4af37" }}
                />
                <Legend />
                <Bar
                  dataKey="totalRevenue"
                  fill={chartColors.primary}
                  name="Revenue"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="customers"
                  fill={chartColors.secondary}
                  name="Customers"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </motion.div>

        {/* Customer Wise Revenue Table */}
        <motion.div
          variants={itemVariants}
          className={`rounded-2xl p-6 transition-all duration-300 ${
            isDark
              ? "bg-dark-800 border border-dark-700"
              : "bg-white border border-gold-100"
          }`}
        >
          <div className="flex items-center justify-between mb-6">
            <h3
              className={`text-lg font-semibold ${
                isDark ? "text-white" : "text-dark-900"
              }`}
            >
              Top Customers by Revenue
            </h3>
            {/* <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                isDark
                  ? "bg-dark-700 text-gold-400 hover:bg-dark-600"
                  : "bg-gold-50 text-gold-600 hover:bg-gold-100"
              }`}
            >
              <Download size={18} />
              <span>Export</span>
            </motion.button> */}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  className={`border-b ${
                    isDark ? "border-dark-700" : "border-gold-100"
                  }`}
                >
                  <th
                    className={`px-4 py-3 text-left text-sm font-semibold ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    Customer Name
                  </th>
                  <th
                    className={`px-4 py-3 text-left text-sm font-semibold ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    Join Date
                  </th>
                  <th
                    className={`px-4 py-3 text-left text-sm font-semibold ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    Status
                  </th>
                  <th
                    className={`px-4 py-3 text-right text-sm font-semibold ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    Revenue
                  </th>
                  <th
                    className={`px-4 py-3 text-right text-sm font-semibold ${
                      isDark ? "text-silver-300" : "text-gray-700"
                    }`}
                  >
                    Collection Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {customerWiseData.slice(0, 10).map((customer, idx) => (
                  <tr
                    key={idx}
                    className={`border-b transition-colors duration-300 hover:${
                      isDark ? "bg-dark-700" : "bg-gold-50"
                    } ${isDark ? "border-dark-700" : "border-gold-100"}`}
                  >
                    <td
                      className={`px-4 py-3 text-sm ${
                        isDark ? "text-silver-300" : "text-gray-700"
                      }`}
                    >
                      {customer.customerName}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm ${
                        isDark ? "text-silver-400" : "text-gray-600"
                      }`}
                    >
                      {new Date(customer.joinDate).toLocaleDateString()}
                    </td>
                    <td className={`px-4 py-3 text-sm`}>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          customer.status === 'Active'
                            ? isDark
                              ? "bg-green-900/30 text-green-400"
                              : "bg-green-100 text-green-700"
                            : customer.status === 'Inactive'
                            ? isDark
                              ? "bg-yellow-900/30 text-yellow-400"
                              : "bg-yellow-100 text-yellow-700"
                            : isDark
                            ? "bg-red-900/30 text-red-400"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {customer.status}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-sm font-semibold text-right ${
                        isDark ? "text-gold-400" : "text-gold-600"
                      }`}
                    >
                      ৳{customer.totalRevenue?.toLocaleString()}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm text-right ${
                        isDark ? "text-silver-300" : "text-gray-700"
                      }`}
                    >
                      {(customer.collectionRate * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* KAM Performance Table */}
          <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 mt-8 transition-all duration-300 ${
              isDark
                ? "bg-dark-800 border border-dark-700"
                : "bg-white border border-gold-100"
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <h3
                className={`text-lg font-semibold ${
                  isDark ? "text-white" : "text-dark-900"
                }`}
              >
                KAM Performance Summary
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className={`border-b ${
                      isDark ? "border-dark-700" : "border-gold-100"
                    }`}
                  >
                    <th
                      className={`px-4 py-3 text-left text-sm font-semibold ${
                        isDark ? "text-silver-300" : "text-gray-700"
                      }`}
                    >
                      KAM Name
                    </th>
                    <th
                      className={`px-4 py-3 text-center text-sm font-semibold ${
                        isDark ? "text-silver-300" : "text-gray-700"
                      }`}
                    >
                      Total Customers
                    </th>
                    <th
                      className={`px-4 py-3 text-center text-sm font-semibold ${
                        isDark ? "text-silver-300" : "text-gray-700"
                      }`}
                    >
                      Active Customers
                    </th>
                    <th
                      className={`px-4 py-3 text-right text-sm font-semibold ${
                        isDark ? "text-silver-300" : "text-gray-700"
                      }`}
                    >
                      Total Revenue
                    </th>
                    <th
                      className={`px-4 py-3 text-right text-sm font-semibold ${
                        isDark ? "text-silver-300" : "text-gray-700"
                      }`}
                    >
                      Avg Revenue/Customer
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {kamPerformanceData.map((kam, idx) => (
                    <tr
                      key={idx}
                      className={`border-b transition-colors duration-300 hover:${
                        isDark ? "bg-dark-700" : "bg-gold-50"
                      } ${isDark ? "border-dark-700" : "border-gold-100"}`}
                    >
                      <td
                        className={`px-4 py-3 text-sm font-medium ${
                          isDark ? "text-gold-400" : "text-gold-600"
                        }`}
                      >
                        {kam.kam}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm text-center ${
                          isDark ? "text-silver-300" : "text-gray-700"
                        }`}
                      >
                        {kam.customers}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm text-center ${
                          isDark ? "text-green-400" : "text-green-600"
                        }`}
                      >
                        {kam.activeCustomers}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-semibold text-right ${
                          isDark ? "text-gold-400" : "text-gold-600"
                        }`}
                      >
                        ৳{kam.totalRevenue?.toLocaleString()}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm text-right ${
                          isDark ? "text-silver-300" : "text-gray-700"
                        }`}
                      >
                        ৳
                        {(kam.totalRevenue / kam.customers).toLocaleString(
                          "en-US",
                          { maximumFractionDigits: 0 }
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
