import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest, updateCsrfToken } from "../api/client";
import type { Settings, User } from "../types";

interface SessionPayload {
  authenticated: boolean;
  user?: User;
  csrfToken: string;
  settings: Settings;
}

interface LoginPayload {
  user: User;
  redirectTo: string;
}

interface AuthContextValue {
  user: User | null;
  settings: Settings;
  loading: boolean;
  login(username: string, password: string, state?: string): Promise<string>;
  logout(): Promise<void>;
  signup(username: string, email: string, password: string): Promise<void>;
  continueWithState(state: string): Promise<string>;
  refresh(): Promise<void>;
}

const defaultSettings: Settings = { signupEnabled: false, adminUiEnabled: true };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json() as SessionPayload;
      updateCsrfToken(payload.csrfToken);
      setSettings(payload.settings ?? defaultSettings);
      setUser(response.ok && payload.authenticated && payload.user ? payload.user : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const unauthorized = () => setUser(null);
    window.addEventListener("coolify-auth:unauthorized", unauthorized);
    return () => window.removeEventListener("coolify-auth:unauthorized", unauthorized);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    settings,
    loading,
    refresh,
    async login(username, password, state) {
      const result = await apiRequest<LoginPayload>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password, ...(state ? { state } : {}) }),
      });
      setUser(result.user);
      return result.redirectTo;
    },
    async logout() {
      await apiRequest<{ loggedOut: boolean }>("/api/auth/logout", { method: "POST" });
      setUser(null);
    },
    async signup(username, email, password) {
      await apiRequest("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      });
    },
    async continueWithState(state) {
      const result = await apiRequest<{ redirectTo: string }>("/api/auth/continue", {
        method: "POST",
        body: JSON.stringify({ state }),
      });
      return result.redirectTo;
    },
  }), [loading, refresh, settings, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
