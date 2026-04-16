import api from "./api";

export const kamService = {
  async list(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append("search", params.search);
    if (params.is_active !== undefined && params.is_active !== "")
      queryParams.append("is_active", params.is_active);
    const qs = queryParams.toString();
    return api.get(`/customers/kam-management/${qs ? `?${qs}` : ""}`);
  },

  async create(payload) {
    return api.post("/customers/kam-management/", payload);
  },

  async update(id, payload) {
    return api.put(`/customers/kam-management/${id}/`, payload);
  },

  async remove(id) {
    return api.delete(`/customers/kam-management/${id}/`);
  },
};
