import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// ---------------------------------------------------------------------------
// Auth-header resilience:
// The hosting reverse proxy may strip the `Authorization` header before the
// request reaches this dev server. The frontend therefore ALSO sends the JWT
// as `X-Camps-Token` and stores it in a `camps_token` cookie (the browser
// attaches cookies automatically). This hook restores the `Authorization`
// header before the request is forwarded to Flask, so the backend can stay
// plain flask-jwt-extended.
// ---------------------------------------------------------------------------
function restoreAuthHeader(proxyReq, req) {
  if (proxyReq.getHeader("authorization")) return;
  let token = req.headers["x-camps-token"];
  if (!token) {
    const cookie = req.headers.cookie || "";
    const match = cookie.match(/(?:^|;\s*)camps_token=([^;]+)/);
    token = match ? decodeURIComponent(match[1]) : null;
  }
  if (token) proxyReq.setHeader("authorization", `Bearer ${token}`);
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", restoreAuthHeader);
        },
      },
    },
  },
});
