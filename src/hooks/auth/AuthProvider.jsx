// src/hooks/auth/AuthProvider.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { http } from "../../client/httpClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  const refreshMe = async () => {
    const { data } = await http.get("/auth/me");
    setUser(data.user);
    return data.user;
  };

  useEffect(() => {
    (async () => {
      try {
        await refreshMe(); // validates cookie + refreshes it
      } catch {
        setUser(null);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  // Optional: keep-alive only on real activity (does NOT touch Supabase)
  useEffect(() => {
    if (!user) return;

    let lastPing = 0;
    const ping = async () => {
      const now = Date.now();
      // debounce: at most once every 2 minutes
      if (now - lastPing < 120_000) return;
      lastPing = now;
      try {
        await refreshMe(); // refresh sliding expiration
      } catch {
        setUser(null);
      }
    };

    const onActivity = () => ping();
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("click", onActivity);
    window.addEventListener("scroll", onActivity);

    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("scroll", onActivity);
    };
  }, [user]);

  const api = useMemo(() => {
    return {
      user,
      booting,
      isAuthed: !!user,

      login: async (email, password) => {
        const { data } = await http.post("/auth/login", { email, password });
        setUser(data.user);
        return data.user;
      },

      logout: async () => {
        try {
          await http.post("/auth/logout");
        } finally {
          setUser(null);
        }
      },
    };
  }, [user, booting]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
