import api from './api';

const billService = {
  getAllBills: (params) => api.get('/bills/entitlements/', { params }),
  getBillById: (id) => api.get(`/bills/entitlements/${id}/`),
  createBill: (data) => api.post('/bills/entitlements/', data),
  updateBill: (id, data) => api.put(`/bills/entitlements/${id}/`, data),
  deleteBill: (id) => api.delete(`/bills/entitlements/${id}/`),
  getLedgerSummary: (params = {}) =>
    api.get('/bills/ledger/summary/', { params: { from_date: params.from_date, to_date: params.to_date } }),
  getLedgerCustomer: (customerId, params = {}) =>
    api.get(`/bills/ledger/customer/${customerId}/`, { params: { from_date: params.from_date, to_date: params.to_date } }),
  createBillWithDetails: (masterData, detailsData) => {
    // First create the entitlement master
    return api.post('/bills/entitlements/', masterData).then(response => {
      const entitlementId = response.data.id;
      // Then create the entitlement details
      if (detailsData && detailsData.length > 0) {
        return api.post(`/bills/entitlements/${entitlementId}/details/`, {
          entitlement_master_id: entitlementId,
          ...detailsData
        }).then(() => response);
      }
      return response;
    });
  },
};

export { billService };
export default billService;