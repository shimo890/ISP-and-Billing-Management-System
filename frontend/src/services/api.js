import axios from "axios";

// http://172.31.82.254
// http://103.146.220.225:223

// Use environment variable or fallback to proxy for local development
// In production, set VITE_API_URL to the full backend URL
const API_URL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 second timeout (increased for large datasets)
});

// Request interceptor for adding auth tokens
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response.data; // Return data directly
  },
  (error) => {
    console.error("API Error:", error);
    console.error("Error Response Data:", error.response?.data);
    console.error("Error Response Status:", error.response?.status);

    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const data = error.response.data;
      let message = "Server error";
      const validationErrors = {};

      // Try to extract detailed error message
      if (data?.error) {
        message = data.error;
      } else if (data?.message) {
        message = data.message;
      } else if (data?.detail) {
        message = data.detail;
      } else if (data?.errors) {
        // Handle validation errors
        if (Array.isArray(data.errors)) {
          message = data.errors.map((e) => e.message || e).join(", ");
        } else if (typeof data.errors === "object") {
          message = Object.entries(data.errors)
            .map(
              ([key, value]) =>
                `${key}: ${Array.isArray(value) ? value.join(", ") : value}`
            )
            .join("; ");
          // Store field-specific errors
          Object.keys(data.errors).forEach((key) => {
            validationErrors[key] = Array.isArray(data.errors[key])
              ? data.errors[key][0]
              : data.errors[key];
          });
        }
      } else if (typeof data === "object" && Object.keys(data).length > 0) {
        // Handle cases like {"pay_amount": ["error message"]}
        message = Object.entries(data)
          .map(
            ([key, value]) =>
              `${key}: ${Array.isArray(value) ? value.join(", ") : value}`
          )
          .join("; ");
      }

      // Include status code for debugging
      const statusCode = error.response.status;
      const fullMessage = `${message} (${statusCode})`;
      const err = new Error(fullMessage);
      err.validationErrors = validationErrors;
      err.statusCode = statusCode;
      // Preserve response for better error handling in components
      err.response = error.response;
      throw err;
    } else if (error.request) {
      // Request was made but no response received
      throw new Error("Network error - please check your connection");
    } else {
      // Something else happened
      throw new Error(error.message || "An unexpected error occurred");
    }
  }
);

export default api;
