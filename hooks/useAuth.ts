"use client";

import { useContext } from "react";
import { AuthContext, type AuthContextType } from "@/components/AuthProvider";

/**
 * The one place to get auth in any component:
 *
 *   const { user, isAuthenticated, login, logout, getToken } = useAuth();
 */
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return ctx;
}

/** Shortcut when you only need the current user (null if logged out). */
export function useUser() {
  return useAuth().user;
}
