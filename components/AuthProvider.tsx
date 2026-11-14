"use client";

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getKeycloakInstance,
  initKeycloak,
  resetKeycloak,
  stripAuthParams,
} from "@/lib/keycloak";
import { getProfile } from "@/lib/api/api";

export interface UserProfile {
  id: string;
  username?: string;
  email?: string;
  name?: string;
  dialect: string;
  region: string;
  /** Billing plan from the token (`plan` claim), defaults to the free tier. */
  plan: string;
  roles: string[];
}

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "error";

export interface AuthContextType {
  status: AuthStatus;
  isLoading: boolean;
  isAuthenticated: boolean;
  user: UserProfile | null;
  error: Error | null;
  login: (redirectUri?: string) => void;
  register: (redirectUri?: string) => void;
  logout: (redirectUri?: string) => void;
  /** Always returns a fresh token (or null). Use this for API calls. */
  getToken: () => Promise<string | null>;
  /** Re-reads the profile (and chat preferences) from the backend. */
  refreshProfile: () => Promise<void>;
  retry: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

/** The token claims we read. Everything else on the token is ignored. */
interface KeycloakClaims {
  sub?: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  dialect?: string;
  region?: string;
  plan?: string;
  realm_access?: { roles?: string[] };
}

function readUser(): UserProfile | null {
  const kc = getKeycloakInstance();
  const t = kc.tokenParsed as KeycloakClaims | undefined;
  if (!t?.sub) return null;

  return {
    id: t.sub,
    username: t.preferred_username,
    email: t.email,
    name: t.name,
    dialect: t.dialect ?? "koloqua",
    region: t.region ?? "Montserrado",
    plan: typeof t.plan === "string" && t.plan ? t.plan : "pekin",
    roles: t.realm_access?.roles ?? [],
  };
}

/**
 * Turns keycloak-js's network errors into something a person can act on. A
 * non-OK token response usually means the web client is confidential (or the
 * redirect URI is not registered).
 */
function toAuthError(err: unknown): Error {
  const response = (err as { response?: Response } | null)?.response;
  if (response) {
    if (response.status === 400 || response.status === 401) {
      return new Error(
        "Keycloak rejected the sign-in. Check that the browser client is a public client and allows this origin.",
      );
    }
    return new Error(`Keycloak responded with status ${response.status}.`);
  }
  return err instanceof Error ? err : new Error("Authentication failed");
}

/**
 * Token claims first, then whatever the backend holds. The backend is the
 * source of truth for dialect and region: a change made in Settings lives
 * there (and in the Keycloak user) before the local token is refreshed.
 */
async function readServerUser(): Promise<UserProfile | null> {
  const kc = getKeycloakInstance();
  const base = readUser();
  if (!base) return null;

  try {
    let token = kc.token;
    if (!token) {
      await kc.updateToken(30);
      token = kc.token;
    }
    if (!token) return base;

    const profile = await getProfile({ token });
    return {
      ...base,
      name: base.name || profile.name,
      username: profile.username || base.username,
      email: profile.email || base.email,
      dialect: profile.dialect || base.dialect,
      region: profile.region || base.region,
    };
  } catch {
    // Offline or backend down: the token is still good enough to render.
    return base;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  const clearSession = useCallback(() => {
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    let cancelled = false;

    initKeycloak()
      .then((authenticated) => {
        if (cancelled) return;
        const kc = getKeycloakInstance();

        // Auto-refresh before the token expires
        kc.onTokenExpired = () => {
          kc.updateToken(30)
            .then(readServerUser)
            .then((profile) => {
              if (cancelled) return;
              if (profile) setUser(profile);
              else clearSession();
            })
            .catch(clearSession);
        };
        kc.onAuthLogout = clearSession;

        if (!authenticated) {
          setStatus("unauthenticated");
          return;
        }

        // Render from the token right away, then fill in dialect/region from
        // the backend once it answers (it may also be offline).
        const profile = readUser();
        setUser(profile);
        setStatus(profile ? "authenticated" : "unauthenticated");

        if (profile) {
          void readServerUser().then((full) => {
            if (!cancelled && full) setUser(full);
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Keycloak init failed:", err);
        setError(toAuthError(err));
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, clearSession]);

  const login = useCallback((redirectUri?: string) => {
    // Never carry a dead `?code=` into a new login round-trip.
    stripAuthParams();
    getKeycloakInstance().login({
      redirectUri: redirectUri ?? window.location.href,
    });
  }, []);

  const register = useCallback((redirectUri?: string) => {
    stripAuthParams();
    getKeycloakInstance().register({
      redirectUri: redirectUri ?? window.location.href,
    });
  }, []);

  const logout = useCallback((redirectUri?: string) => {
    getKeycloakInstance().logout({
      redirectUri: redirectUri ?? window.location.origin,
    });
  }, []);

  const getToken = useCallback(async () => {
    const kc = getKeycloakInstance();
    if (!kc.authenticated) return null;
    try {
      await kc.updateToken(30);
      return kc.token ?? null;
    } catch {
      clearSession();
      return null;
    }
  }, [clearSession]);

  const refreshProfile = useCallback(async () => {
    const profile = await readServerUser();
    if (profile) setUser(profile);
  }, []);

  const retry = useCallback(() => {
    // A failed login callback is dead; start over from a clean URL.
    stripAuthParams();
    resetKeycloak();
    setStatus("loading");
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      status,
      isLoading: status === "loading",
      isAuthenticated: status === "authenticated",
      user,
      error,
      login,
      register,
      logout,
      getToken,
      refreshProfile,
      retry,
    }),
    [status, user, error, login, register, logout, getToken, refreshProfile, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
