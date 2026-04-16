// Role Service - handles role management API calls
import api from "./api";

export const roleService = {
  // Get all roles (uses limit/offset for backend pagination)
  async getRoles(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.append("search", filters.search);
      const pageSize = filters.pageSize ?? 10;
      const page = filters.page ?? 1;
      const limit = Math.min(Math.max(1, pageSize), 100);
      const offset = (page - 1) * limit;
      queryParams.append("limit", limit);
      queryParams.append("offset", offset);
      const url = `/auth/roles/${queryParams.toString() ? "?" + queryParams.toString() : ""}`;
      const response = await api.get(url);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Get all permissions
  async getPermissions() {
    try {
      // Try to get all permissions, handle pagination if present
      let allPermissions = [];
      let nextUrl = "/auth/permissions/";
      let page = 1;

      while (nextUrl && page <= 10) {
        // Limit to 10 pages to prevent infinite loops
        const response = await api.get(nextUrl);

        let permissions = [];
        if (Array.isArray(response)) {
          permissions = response;
        } else if (response?.data && Array.isArray(response.data)) {
          permissions = response.data;
        } else if (response?.results && Array.isArray(response.results)) {
          permissions = response.results;
        }

        allPermissions = [...allPermissions, ...permissions];

        // Check for pagination
        if (response?.next) {
          // Extract only the path and query string from the next URL
          // This prevents port/domain mismatch issues
          try {
            const url = new URL(response.next);
            // Remove any duplicate /api prefix from the path
            let path = url.pathname + url.search;
            if (path.startsWith("/api/")) {
              path = path.substring(4); // Remove the first /api
            }
            nextUrl = path;
          } catch (e) {
            // If it's already a relative URL, use it as is
            let path = response.next;
            if (path.startsWith("/api/")) {
              path = path.substring(4); // Remove the first /api
            }
            nextUrl = path;
          }
          page++;
        } else {
          nextUrl = null;
        }
      }

      return allPermissions;
    } catch (error) {
      throw error;
    }
  },

  // Get predefined role name choices
  async getRoleChoices() {
    try {
      const response = await api.get("/auth/role-choices/");
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Get role by ID
  async getRoleById(id) {
    try {
      const response = await api.get(`/auth/roles/${id}/`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Create new role
  async createRole(roleData) {
    try {
      const response = await api.post("/auth/roles/", roleData);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Update role
  async updateRole(id, roleData) {
    try {
      const response = await api.put(`/auth/roles/${id}/`, roleData);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Delete role
  async deleteRole(id) {
    try {
      const response = await api.delete(`/auth/roles/${id}/`);
      return response;
    } catch (error) {
      throw error;
    }
  },
};
