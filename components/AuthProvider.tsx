"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import Keycloak from "keycloak-js";
import { getKeycloakInstance } from "@/lib/keycloak";
import { styles } from "@/components/chat.module.css";

interface UserProfile {
  sub?: string;
  preferred_username?: string;
  email?: string;
  name?: string;
  dialect?: string;
  region?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  user: UserProfile | null;
  login: () => void;
  logout: () => void;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  token: null,
  user: null,
  login: () => {},
  logout: () => {},
  getToken: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const keycloak = getKeycloakInstance();

    keycloak
      .init({
        onLoad: "check-sso", // Checks if user is already logged in without forcing redirect
        pkceMethod: "S256",
        checkLoginIframe: false, // Prevents third-party cookie iframe warnings
      })
      .then((authenticated) => {
        setIsAuthenticated(authenticated);
        if (authenticated && keycloak.token) {
          setToken(keycloak.token);
          // Parse token claims directly
          const parsed = keycloak.tokenParsed as any;
          setUser({
            sub: parsed?.sub,
            preferred_username: parsed?.preferred_username,
            email: parsed?.email,
            name: parsed?.name,
            dialect: parsed?.dialect || "koloqua",
            region: parsed?.region || "Montserrado",
          });
        }
      })
      .catch((err) => {
        console.error("Keycloak init failed:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Event listener when token refreshes
    keycloak.onTokenExpired = () => {
      keycloak
        .updateToken(30)
        .then((refreshed) => {
          if (refreshed && keycloak.token) {
            setToken(keycloak.token);
          }
        })
        .catch(() => {
          setIsAuthenticated(false);
          setToken(null);
        });
    };
  }, []);

  const login = () => {
    const keycloak = getKeycloakInstance();
    // Redirects to Keycloak's built-in login & registration page
    keycloak.login({
      redirectUri: window.location.origin,
    });
  };

  const logout = () => {
    const keycloak = getKeycloakInstance();
    keycloak.logout({
      redirectUri: window.location.origin,
    });
  };

  // Helper function to get valid token, refreshing if needed
  const getToken = async (): Promise<string | null> => {
    const keycloak = getKeycloakInstance();
    if (!keycloak.authenticated) return null;
    try {
      // Refresh token if expired or expiring within 30 seconds
      await keycloak.updateToken(30);
      setToken(keycloak.token || null);
      return keycloak.token || null;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        token,
        user,
        login,
        logout,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
