import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { signInToWix, signOutWix } from "@/lib/wix";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Wix federation status: { state: 'idle'|'syncing'|'member'|'synced'|'error', memberId, signOnAvailable, error }
  const [wix, setWix] = useState({ state: "idle" });

  const syncWix = useCallback(async () => {
    setWix({ state: "syncing" });
    try {
      const r = await signInToWix();
      setWix({
        state: r.member ? "member" : "synced",
        memberId: r.memberId,
        signOnAvailable: r.signOnAvailable,
      });
    } catch (e) {
      setWix({ state: "error", error: e?.message });
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await base44.auth.me();
      setUser(me || null);
      if (me) syncWix();
      else setWix({ state: "idle" });
    } catch {
      setUser(null);
      setWix({ state: "idle" });
    } finally {
      setLoading(false);
    }
  }, [syncWix]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email, password) => {
      await base44.auth.loginViaEmailPassword(email, password);
      await refresh();
    },
    [refresh],
  );

  const register = useCallback(async (email, password) => {
    await base44.auth.register({ email, password });
  }, []);

  const verifyOtp = useCallback(async (email, otpCode) => {
    await base44.auth.verifyOtp({ email, otpCode });
  }, []);

  const logout = useCallback(() => {
    signOutWix();
    base44.auth.logout("/");
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, verifyOtp, logout, refresh, wix, syncWix }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
