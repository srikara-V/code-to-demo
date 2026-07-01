import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Frontend on :5173, backend on :3001. Everything under /api is proxied to the
// backend so the browser stays on one origin (and GitHub's OAuth callback,
// which lands on /api/auth/github/callback, reaches the server through here).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:3001" },
  },
});
