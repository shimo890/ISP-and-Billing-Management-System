// Package Service - handles package API calls
import api from "./api";

export const packageService = {
  // Get all packages (uses limit/offset for backend pagination)
  async getAllPackages(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append("search", params.search);
    if (params.package_type) queryParams.append("package_type", params.package_type);
    // Backend uses limit/offset; convert page/pageSize if provided
    const pageSize = params.pageSize ?? 10;
    const page = params.page ?? 1;
    const limit = Math.min(Math.max(1, pageSize), 100);
    const offset = (page - 1) * limit;
    queryParams.append("limit", limit);
    queryParams.append("offset", offset);
    const url = `/packages/${queryParams.toString() ? "?" + queryParams.toString() : ""}`;
    return await api.get(url);
  },

  // Create a new package
  async createPackage(data) {
    return await api.post("/packages/", data);
  },

  // Update a package by id
  async updatePackage(id, data) {
    return await api.put(`/packages/${id}/`, data);
  },

  // Delete a package by id
  async deletePackage(id) {
    return await api.delete(`/packages/${id}/`);
  },
};