import api from './api';

const customerService = {
  getAllCustomers: (params) => api.get('/customers/', { params }),
  getCustomerById: (id) => api.get(`/customers/${id}/`),
  createCustomer: (data) => api.post('/customers/', data),
  updateCustomer: (id, data) => api.put(`/customers/${id}/`, data),
  deleteCustomer: (id) => api.delete(`/customers/${id}/`),
};

export { customerService };
export default customerService;