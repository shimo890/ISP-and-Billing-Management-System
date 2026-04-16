import api from './api';

const dashboardService = {
  /**
   * Get complete dashboard analytics
   * Single endpoint that returns all analytics data
   * @returns {Promise<Object>} Complete analytics data
   */
  getCompleteAnalytics: async () => {
    try {
      const response = await api.get('/bills/analytics/dashboard/');
      return response || {};
    } catch (error) {
      console.error('Error fetching complete analytics:', error);
      throw error;
    }
  },

  /**
   * Get revenue analytics
   * @returns {Promise<Object>} Revenue data (daily, weekly, monthly, yearly)
   */
  getRevenueAnalytics: async () => {
    try {
      const data = await dashboardService.getCompleteAnalytics();
      return data.revenue || {};
    } catch (error) {
      console.error('Error fetching revenue analytics:', error);
      throw error;
    }
  },

  /**
   * Get collection analytics
   * @returns {Promise<Object>} Collection data (daily, weekly, monthly, by customer)
   */
  getCollectionAnalytics: async () => {
    try {
      const data = await dashboardService.getCompleteAnalytics();
      return data.collections || {};
    } catch (error) {
      console.error('Error fetching collection analytics:', error);
      throw error;
    }
  },

  /**
   * Get customer analytics
   * @returns {Promise<Object>} Customer data (active, breakdown by type)
   */
  getCustomerAnalytics: async () => {
    try {
      const data = await dashboardService.getCompleteAnalytics();
      return data.customers || {};
    } catch (error) {
      console.error('Error fetching customer analytics:', error);
      throw error;
    }
  },

  /**
   * Get due/outstanding analytics
   * @returns {Promise<Object>} Due data (total due, overdue)
   */
  getDueAnalytics: async () => {
    try {
      const data = await dashboardService.getCompleteAnalytics();
      return data.due || {};
    } catch (error) {
      console.error('Error fetching due analytics:', error);
      throw error;
    }
  },

  /**
   * Get customer type breakdown
   * @returns {Promise<Object>} Customer types (BW, Channel Partner, SOHO)
   */
  getCustomerTypesAnalytics: async () => {
    try {
      const data = await dashboardService.getCompleteAnalytics();
      return data.customer_types || {};
    } catch (error) {
      console.error('Error fetching customer types analytics:', error);
      throw error;
    }
  },

  /**
   * Get KAM performance analytics
   * @returns {Promise<Object>} KAM data (monthly, weekly, overall)
   */
  getKAMPerformance: async () => {
    try {
      const data = await dashboardService.getCompleteAnalytics();
      return data.kam_performance || {};
    } catch (error) {
      console.error('Error fetching KAM performance:', error);
      throw error;
    }
  },

  /**
   * Get customer engagement analytics
   * @returns {Promise<Object>} Engagement data (weekly, monthly, yearly)
   */
  getEngagementAnalytics: async () => {
    try {
      const data = await dashboardService.getCompleteAnalytics();
      return data.engagement || {};
    } catch (error) {
      console.error('Error fetching engagement analytics:', error);
      throw error;
    }
  },

  /**
   * Get customer churn analytics
   * @returns {Promise<Object>} Churn data (monthly, yearly)
   */
  getChurnAnalytics: async () => {
    try {
      const data = await dashboardService.getCompleteAnalytics();
      return data.churn || {};
    } catch (error) {
      console.error('Error fetching churn analytics:', error);
      throw error;
    }
  },

  /**
   * Legacy methods - for backward compatibility
   * Get weekly revenue analytics
   * @returns {Promise<Array>} Weekly revenue data
   */
  getWeeklyRevenue: async () => {
    try {
      const data = await dashboardService.getCompleteAnalytics();
      const weekly = data.revenue?.weekly || {};
      return [{
        name: 'Weekly',
        revenue: weekly.total_revenue || 0,
        invoices: weekly.invoice_count || 0,
        period: weekly.period || '',
      }];
    } catch (error) {
      console.error('Error fetching weekly revenue:', error);
      throw error;
    }
  },

  /**
   * Get monthly revenue analytics
   * @returns {Promise<Array>} Monthly revenue data
   */
  getMonthlyRevenue: async () => {
    try {
      const data = await dashboardService.getCompleteAnalytics();
      const monthly = data.revenue?.monthly || {};
      return [{
        name: 'Monthly',
        revenue: monthly.total_revenue || 0,
        invoices: monthly.invoice_count || 0,
        period: monthly.period || '',
      }];
    } catch (error) {
      console.error('Error fetching monthly revenue:', error);
      throw error;
    }
  },

  /**
   * Get yearly revenue analytics
   * @returns {Promise<Array>} Yearly revenue data
   */
  getYearlyRevenue: async () => {
    try {
      const data = await dashboardService.getCompleteAnalytics();
      const yearly = data.revenue?.yearly || {};
      return [{
        name: 'Yearly',
        revenue: yearly.total_revenue || 0,
        invoices: yearly.invoice_count || 0,
        period: yearly.period || '',
      }];
    } catch (error) {
      console.error('Error fetching yearly revenue:', error);
      throw error;
    }
  },

  /**
   * Get customer-wise revenue analytics
   * @returns {Promise<Array>} Customer-wise revenue data
   */
  getCustomerWiseRevenue: async () => {
    try {
      const data = await dashboardService.getCompleteAnalytics();
      const byCustomer = data.collections?.by_customer || [];
      return byCustomer.map(customer => ({
        customer_id: customer.customer_id,
        customer_name: customer.customer_name,
        customer_type: customer.customer_type,
        total_invoiced: customer.total_invoiced,
        total_collected: customer.total_collected,
        collection_rate: customer.collection_rate,
        outstanding_balance: customer.outstanding_balance,
      }));
    } catch (error) {
      console.error('Error fetching customer-wise revenue:', error);
      throw error;
    }
  },

  /**
   * Get dashboard summary statistics
   * @returns {Promise<Object>} Summary statistics
   */
  getSummary: async () => {
    try {
      const data = await dashboardService.getCompleteAnalytics();
      
      const revenue = data.revenue || {};
      const collections = data.collections || {};
      const customers = data.customers || {};
      const due = data.due || {};
      const kam = data.kam_performance || {};
      const engagement = data.engagement || {};
      const churn = data.churn || {};

      return {
        timestamp: data.timestamp,
        revenue,
        collections,
        customers,
        due,
        customerTypes: data.customer_types || {},
        kamPerformance: kam,
        engagement,
        churn,
        // Compute summary KPIs
        totalRevenue: revenue.monthly?.total_revenue || 0,
        weeklyRevenue: revenue.weekly?.total_revenue || 0,
        totalCollected: collections.total_collected?.total_collected || 0,
        totalDue: due.total_due || 0,
        totalCustomers: customers.total_customers || 0,
        activeCustomers: customers.total_active_customers || 0,
        collectionRate: collections.weekly?.collection_rate || 0,
        engagementRatio: engagement.weekly?.engagement_ratio || 0,
        churnRate: churn.monthly?.churn_rate || 0,
      };
    } catch (error) {
      console.error('Error fetching dashboard summary:', error);
      throw error;
    }
  },

  /**
   * Get KPIs data (legacy method)
   * @returns {Promise<Object>} KPI data
   */
  getKPIs: async () => {
    try {
      const summary = await dashboardService.getSummary();
      return {
        total_revenue: summary.totalRevenue,
        total_customers: summary.totalCustomers,
        active_customers: summary.activeCustomers,
        collection_rate: summary.collectionRate,
        total_revenue_change: 0,
        total_customers_change: 0,
        active_customers_change: 0,
        collection_rate_change: 0,
      };
    } catch (error) {
      console.error('Error fetching KPIs:', error);
      throw error;
    }
  },
};

export { dashboardService };
