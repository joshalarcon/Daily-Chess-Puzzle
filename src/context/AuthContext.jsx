/**
 * AuthContext.jsx
 *
 * Provides global user authentication state across the app.
 *
 * Supported auth methods:
 *   - Guest  : user picks a username, stored in localStorage
 *   - Facebook: stub that sets provider to "facebook" (real OAuth
 *               can be wired in later via Firebase / Auth.js)
 *
 * Persisted keys in localStorage:
 *   chess_user  — JSON { username, provider, avatar, joinedAt }
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "chess_user";

/* ── Shape of a user object ─────────────────────────────────────────────── */
// {
//   username : string
//   provider : "guest" | "facebook"
//   avatar   : string | null   (URL or null → shows initials)
//   joinedAt : ISO date string
// }

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ── Hydrate from localStorage on mount ──────────────────────────────── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // Corrupted entry — ignore
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Persist user to localStorage whenever it changes ───────────────── */
  useEffect(() => {
    if (loading) return;
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user, loading]);

  /* ── Actions ─────────────────────────────────────────────────────────── */

  /** Sign in as a guest with a chosen username */
  const loginAsGuest = useCallback((username) => {
    setUser({
      username: username.trim(),
      provider: "guest",
      avatar: null,
      joinedAt: new Date().toISOString(),
    });
  }, []);

  /**
   * Sign in via Facebook (stub).
   * In production replace the body with a real OAuth popup flow.
   */
  const loginWithFacebook = useCallback(() => {
    // Stub: generate a placeholder Facebook user
    setUser({
      username: "FacebookUser",
      provider: "facebook",
      avatar: null, // replace with FB profile pic URL after real OAuth
      joinedAt: new Date().toISOString(),
    });
  }, []);

  /** Update the username (guests only) */
  const updateUsername = useCallback((newUsername) => {
    setUser((prev) => prev ? { ...prev, username: newUsername.trim() } : prev);
  }, []);

  /** Sign out */
  const logout = useCallback(() => setUser(null), []);

  /* ── Derived helpers ─────────────────────────────────────────────────── */

  /** Returns the first 1–2 characters to render inside the avatar circle */
  const initials = user
    ? user.username.slice(0, 2).toUpperCase()
    : "?";

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLoggedIn: !!user,
        initials,
        loginAsGuest,
        loginWithFacebook,
        updateUsername,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Convenience hook */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
