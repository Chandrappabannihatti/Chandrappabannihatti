import axios from "axios";

const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("camps_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    // Some reverse proxies strip Authorization — the Vite proxy restores it
    // from this custom header (or from the camps_token cookie). See vite.config.js.
    config.headers["X-Camps-Token"] = token;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem("camps_token")) {
      // Token expired/invalid -> force re-login
      localStorage.removeItem("camps_token");
      localStorage.removeItem("camps_user");
      document.cookie = "camps_token=; path=/; max-age=0";
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
