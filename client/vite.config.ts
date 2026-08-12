import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Lets the frontend call /api/... during dev without CORS fuss,
      // forwarded straight to the Express server.
      "/api": "http://localhost:4000",
    },
  },
});
