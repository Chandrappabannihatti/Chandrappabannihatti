import { createContext, useCallback, useContext, useMemo, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("camps_user"));
    } catch {
      return null;
    }
  });

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("camps_token", data.access_token);
    localStorage.setItem("camps_user", JSON.stringify(data.user));
    // Cookie fallback: the Vite proxy can rebuild the Authorization header
    // from this if the hosting proxy strips it. See vite.config.js.
    document.cookie = `camps_token=${encodeURIComponent(data.access_token)}; path=/; SameSite=Lax`;
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* token may already be invalid */
    }
    localStorage.removeItem("camps_token");
    localStorage.removeItem("camps_user");
    document.cookie = "camps_token=; path=/; max-age=0";
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      isAuthenticated: !!user,
      role: user?.role,
    }),
    [user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
