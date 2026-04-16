// Company Reports Page Component
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, Users, DollarSign, Calendar,
  Download, RefreshCw, FileText, PieChart
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import KPICard from '../components/KPICard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import { dashboardService } from '../services/dashboardService';
import { customerService } from '../services/customerService';
import { billService } from '../services/billService';

const CompanyReports = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState({
    revenue: {
      total_bills: 0,
      total_amount: 0,
      total_received: 0,
      total_due: 0,
      avg_bill: 0
    },
    customers: {
      total_active: 0
    },
    recent_entries: {
      bills: [],
      customers: []
    },
    data_entry_performance: [],
    rawMetrics: {
      totalRevenue: 0,
      totalReceived: 0
    }
  });
  const [dateRange, setDateRange] = useState({
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    fetchCompanyReports();
  }, [dateRange]);

  const fetchCompanyReports = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch data from multiple services
      const [kpisRes, monthlyRes, customerWiseRes, billsRes, customersRes] = await Promise.all([
        dashboardService.getKPIs(),
        dashboardService.getMonthlyRevenue(),
        dashboardService.getCustomerWiseRevenue(),
        billService.getAllBills({ limit: 10 }),
        customerService.getAllCustomers({ limit: 10 })
      ]);

      const kpis = kpisRes.data || kpisRes;
      const monthly = monthlyRes.data || monthlyRes;
      const customerWise = customerWiseRes.data || customerWiseRes;
      const bills = billsRes.data || billsRes;
      const customers = customersRes.data || customersRes;

      // Use KPI data from API
      const totalRevenue = kpis.total_revenue || 0;
      const totalCustomers = kpis.total_customers || 0;
      const activeCustomers = kpis.active_customers || 0;
      const collectionRate = kpis.collection_rate || 0;

      // Calculate additional metrics for display
      const monthlyArray = Array.isArray(monthly) ? monthly : [];
      const customerWiseArray = Array.isArray(customerWise) ? customerWise : [];
      const totalReceived = customerWiseArray.reduce((sum, customer) => sum + (customer.totalReceived || 0), 0);
      const totalDue = customerWiseArray.reduce((sum, customer) => sum + (customer.totalDue || 0), 0);
      const billsArray = Array.isArray(bills) ? bills : [];
      const totalBills = billsRes.data?.count || billsArray.length;
      const avgBill = totalBills > 0 ? totalRevenue / totalBills : 0;

      // Format currency values
      const formatCurrency = (amount) => `৳${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

      setReportData({
        revenue: {
          total_bills: totalBills,
          total_amount: formatCurrency(totalRevenue),
          total_received: formatCurrency(totalReceived),
          total_due: formatCurrency(totalDue),
          avg_bill: formatCurrency(avgBill)
        },
        customers: {
          total_active: activeCustomers
        },
        kpis: kpis,
        recent_entries: {
          bills: billsArray.slice(0, 3).map(bill => ({
            id: bill.id,
            customer_name: bill.customer?.name || 'Unknown Customer',
            amount: bill.total_bill || 0,
            date: bill.billing_date || bill.created_at
          })),
          customers: (Array.isArray(customers) ? customers.slice(0, 2) : []).map(customer => ({
            id: customer.id,
            name: customer.name,
            join_date: customer.created_at
          }))
        },
        data_entry_performance: [
          { user: 'john_doe', entries: 45, accuracy: 98.5 },
          { user: 'admin', entries: 32, accuracy: 99.2 },
          { user: 'manager', entries: 28, accuracy: 97.8 }
        ],
        rawMetrics: {
          totalRevenue,
          totalReceived
        }
      });
    } catch (err) {
      setError(err.message || 'Failed to fetch company reports');
    } finally {
      setLoading(false);
    }
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
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      {/* Header */}
      <div className={`sticky top-0 z-40 backdrop-blur-md border-b transition-all duration-300 ${
        isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className={`text-3xl sm:text-4xl font-bold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Company Reports
              </h1>
              <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Comprehensive business analytics and insights
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={fetchCompanyReports}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  isDark
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <RefreshCw size={20} />
              </motion.button>
              {/* <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  isDark
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <Download size={18} />
                <span>Export Report</span>
              </motion.button> */}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

        {/* Date Range Filter */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className={`rounded-2xl p-6 mb-6 transition-all duration-300 ${
            isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.start_date}
                onChange={(e) => setDateRange(prev => ({ ...prev, start_date: e.target.value }))}
                className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                End Date
              </label>
              <input
                type="date"
                value={dateRange.end_date}
                onChange={(e) => setDateRange(prev => ({ ...prev, end_date: e.target.value }))}
                className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
            <button
              onClick={fetchCompanyReports}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Filter
            </button>
          </div>
        </motion.div>

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
              value={`৳${(reportData.kpis?.total_revenue || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              icon={DollarSign}
              color="green"
              trend="up"
              trendValue={`${reportData.kpis?.total_revenue_change || 0}%`}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KPICard
              title="Total Customers"
              value={reportData.kpis?.total_customers || 0}
              icon={Users}
              color="blue"
              trend="up"
              trendValue={`${reportData.kpis?.total_customers_change || 0}%`}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KPICard
              title="Active Customers"
              value={reportData.kpis?.active_customers || 0}
              icon={TrendingUp}
              color="green"
              trend="up"
              trendValue={`${reportData.kpis?.active_customers_change || 0}%`}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KPICard
              title="Collection Rate"
              value={`${reportData.kpis?.collection_rate || 0}%`}
              icon={Calendar}
              color="purple"
              trend="up"
              trendValue={`${reportData.kpis?.collection_rate_change || 0}%`}
            />
          </motion.div>
        </motion.div>

        {/* Reports Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
        >
          {/* Recent Entries */}
          <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 transition-all duration-300 ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}
          >
            <h3 className={`text-lg font-semibold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Recent Bill Entries
            </h3>
            <div className="space-y-3">
              {reportData.recent_entries.bills.map((bill) => (
                <div key={bill.id} className={`flex items-center justify-between p-3 rounded-lg ${
                  isDark ? 'bg-gray-700' : 'bg-gray-50'
                }`}>
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {bill.customer_name}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {new Date(bill.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`font-semibold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    ৳{bill.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Data Entry Performance */}
          {/* <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 transition-all duration-300 ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}
          >
            <h3 className={`text-lg font-semibold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Data Entry Performance
            </h3>
            <div className="space-y-3">
              {reportData.data_entry_performance.map((user, index) => (
                <div key={index} className={`flex items-center justify-between p-3 rounded-lg ${
                  isDark ? 'bg-gray-700' : 'bg-gray-50'
                }`}>
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {user.user}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {user.entries} entries
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-semibold ${
                      user.accuracy >= 98 ? 'text-green-600' :
                      user.accuracy >= 95 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {user.accuracy}%
                    </span>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      accuracy
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div> */}

          {/* Revenue Breakdown */}
          <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 transition-all duration-300 ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}
          >
            <h3 className={`text-lg font-semibold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Revenue Breakdown
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Total Received
                </span>
                <span className={`font-semibold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                  {reportData.revenue.total_received}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Outstanding Due
                </span>
                <span className={`font-semibold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  {reportData.revenue.total_due}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Average Bill
                </span>
                <span className={`font-semibold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  {reportData.revenue.avg_bill}
                </span>
              </div>
            </div>
          </motion.div>

          {/* New Customers */}
          <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 transition-all duration-300 ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}
          >
            <h3 className={`text-lg font-semibold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Recent Customer Additions
            </h3>
            <div className="space-y-3">
              {reportData.recent_entries.customers.map((customer) => (
                <div key={customer.id} className={`flex items-center justify-between p-3 rounded-lg ${
                  isDark ? 'bg-gray-700' : 'bg-gray-50'
                }`}>
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {customer.name}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Joined {new Date(customer.join_date).toLocaleDateString()}
                    </p>
                  </div>
                  <Users className={`h-5 w-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Summary Section */}
        <motion.div
          variants={itemVariants}
          className={`rounded-2xl p-6 transition-all duration-300 ${
            isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
          }`}
        >
          <h3 className={`text-lg font-semibold mb-4 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Report Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className={`text-2xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                {reportData.revenue.total_bills}
              </div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Total Bills Processed
              </div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                {reportData.kpis?.active_customers || 0}
              </div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Active Customers
              </div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                {reportData.kpis?.collection_rate || 0}%
              </div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Collection Rate
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CompanyReports;