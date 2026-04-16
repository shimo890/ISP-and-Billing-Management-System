import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local dev: proxy /api → your Django runserver (must match the port you use).
// If you ever need to point at a remote API, change `target` below or set
// VITE_API_URL in frontend/.env to a full URL (that bypasses this proxy).

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        // target: "http://103.146.220.225:223", // remote API (not your local SQLite)
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
