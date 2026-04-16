import React, { useState, useEffect } from "react";
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie,
  Cell,
  XAxis, YAxis,
  CartesianGrid,
  Tooltip, Legend,
  ResponsiveContainer
} from "recharts";
import {
  DollarSign, Users, TrendingUp, AlertCircle, Activity
} from "lucide-react";
import { dashboardService } from "../services/dashboardService";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorAlert from "../components/ErrorAlert";

/**
 * DashboardAnalytics Component
 * Integrates the /api/bills/analytics/dashboard/ endpoint
 */
export default function DashboardAnalytics() {
  // State Management
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch analytics on component mount
  useEffect(() => {
    fetchAnalytics();
    // Optional: Set up auto-refresh every 5 minutes
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
      console.error('Error fetching analytics:', err);
      setError(err.message || 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} onRetry={fetchAnalytics} />;
  if (!analytics) return <div className="text-center py-8">No data available</div>;

  const { revenue, collections, customers, due, customer_types, kam_performance, engagement, churn } = analytics;

  // ==================== TAB 1: OVERVIEW ====================
  const renderOverview = () => (
    <div className="space-y-6">
      {/* KPI Cards Row 1: Revenue & Collections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Weekly Revenue"
          value={`$${(revenue.weekly.total_revenue).toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          change={revenue.weekly.invoice_count}
          changeLabel="Invoices"
          icon={<DollarSign className="w-5 h-5" />}
          trend="up"
        />
        <KPICard
          title="Total Collections"
          value={`$${(collections.total_collected.total_collected).toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          change={collections.total_collected.total_transactions}
          changeLabel="Transactions"
          icon={<TrendingUp className="w-5 h-5" />}
          trend="up"
        />
        <KPICard
          title="Total Outstanding"
          value={`$${(due.total_due).toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          change={due.invoice_count}
          changeLabel="Invoices Due"
          icon={<AlertCircle className="w-5 h-5" />}
          trend="down"
        />
        <KPICard
          title="Active Customers"
          value={customers.total_active_customers}
          change={customers.total_customers}
          changeLabel="Total Customers"
          icon={<Users className="w-5 h-5" />}
          trend="up"
        />
      </div>

      {/* KPI Cards Row 2: Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Weekly Collection Rate"
          value={`${(collections.weekly.collection_rate).toFixed(1)}%`}
          change={0}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <KPICard
          title="Engagement Ratio"
          value={`${(engagement.weekly.engagement_ratio).toFixed(1)}%`}
          change={engagement.weekly.engaged_customers}
          changeLabel="Engaged Customers"
          icon={<Activity className="w-5 h-5" />}
        />
        <KPICard
          title="Monthly Churn Rate"
          value={`${(churn.monthly.churn_rate).toFixed(1)}%`}
          change={churn.monthly.churned_customers}
          changeLabel="Churned"
          icon={<AlertCircle className="w-5 h-5" />}
          trend="down"
        />
      </div>

      {/* Charts Row 1: Revenue & Collections Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Periods Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Revenue by Period</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              { period: 'Daily', revenue: revenue.daily.total_revenue },
              { period: 'Weekly', revenue: revenue.weekly.total_revenue },
              { period: 'Monthly', revenue: revenue.monthly.total_revenue },
              { period: 'Yearly', revenue: revenue.yearly.total_revenue },
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
              <Bar dataKey="revenue" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Collections by Period Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Collections by Period</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              { period: 'Daily', collected: collections.daily.total_collected },
              { period: 'Weekly', collected: collections.weekly.total_collected },
              { period: 'Monthly', collected: collections.monthly.total_collected },
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
              <Bar dataKey="collected" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2: Customer & Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Type Distribution */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Customer Type Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'BW', value: customer_types.bandwidth.total_customers },
                  { name: 'SOHO', value: customer_types.soho.total_customers },
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                <Cell fill="#3b82f6" />
                <Cell fill="#f59e0b" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Status Distribution */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Customer Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              { status: 'Active', count: customers.customer_status.active.count },
              { status: 'Inactive', count: customers.customer_status.inactive.count },
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  // ==================== TAB 2: REVENUE DETAILS ====================
  const renderRevenueDetails = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Daily', data: revenue.daily },
          { label: 'Weekly', data: revenue.weekly },
          { label: 'Monthly', data: revenue.monthly },
          { label: 'Yearly', data: revenue.yearly },
        ].map(item => (
          <div key={item.label} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{item.label}</h4>
            <div className="text-2xl font-bold mb-2">
              ${(item.data.total_revenue).toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-gray-500">
              {item.data.invoice_count} invoices
            </div>
            <div className="text-xs text-gray-400 mt-2">{item.data.period}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ==================== TAB 3: COLLECTIONS ====================
  const renderCollections = () => (
    <div className="space-y-6">
      {/* Customer-wise Collections Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold">Customer-wise Collections</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">Customer Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Type</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Invoiced</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Collected</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Outstanding</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Rate %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {collections.by_customer.slice(0, 10).map(customer => (
                <tr key={customer.customer_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-3">{customer.customer_name}</td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                      {customer.customer_type}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    ${(customer.total_invoiced).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-3 text-right text-green-600">
                    ${(customer.total_collected).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-3 text-right text-red-600">
                    ${(customer.outstanding_balance).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-3 text-right">{(customer.collection_rate).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-400">
          Showing top 10 customers (Total: {collections.by_customer.length})
        </div>
      </div>
    </div>
  );

  // ==================== TAB 4: KAM PERFORMANCE ====================
  const renderKAMPerformance = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold">KAM Performance (This Month)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">KAM Name</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Customers</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Invoices</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Revenue</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Collected</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Rate %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {kam_performance.monthly
                .sort((a, b) => b.total_revenue - a.total_revenue)
                .map(kam => (
                  <tr key={kam.kam_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-3 font-medium">{kam.kam_name}</td>
                    <td className="px-6 py-3 text-right">{kam.customers_count}</td>
                    <td className="px-6 py-3 text-right">{kam.invoices_count}</td>
                    <td className="px-6 py-3 text-right text-green-600">
                      ${(kam.total_revenue).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-3 text-right">
                      ${(kam.total_collected).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-3 text-right">{(kam.collection_rate).toFixed(1)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Analytics</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Last updated: {new Date(analytics.timestamp).toLocaleString()}
            </p>
          </div>
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'revenue', label: 'Revenue' },
            { id: 'collections', label: 'Collections' },
            { id: 'kam', label: 'KAM Performance' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium transition ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="animate-fadeIn">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'revenue' && renderRevenueDetails()}
          {activeTab === 'collections' && renderCollections()}
          {activeTab === 'kam' && renderKAMPerformance()}
        </div>
      </div>
    </div>
  );
}
