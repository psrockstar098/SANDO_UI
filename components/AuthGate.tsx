"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

interface AuthGateProps {
  children: React.ReactNode;
  /** true (default): redirect to login when logged out. false: just wait for auth check, then render. */
  requireAuth?: boolean;
  /** Custom loading UI */
  fallback?: React.ReactNode;
}

/** How long the error screen stays up before returning to the public home page. */
const HOME_REDIRECT_MS = 8_000;

function DefaultLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, sans-serif",
        color: "#666",
      }}
    >
      {label}
    </div>
  );
}

export function AuthGate({
  children,
  requireAuth = true,
  fallback,
}: AuthGateProps) {
  const { status, login, retry, error } = useAuth();

  // Send logged-out users to Keycloak (only when login is required)
  useEffect(() => {
    if (requireAuth && status === "unauthenticated") login();
  }, [requireAuth, status, login]);

  // A failed sign-in must not strand the user on a dead screen. The home page
  // is public, and its "Sign in" link starts a fresh login round-trip.
  useEffect(() => {
    if (!requireAuth || status !== "error") return;
    const timer = setTimeout(() => window.location.replace("/"), HOME_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [requireAuth, status]);

  if (requireAuth && status === "loading") {
    return <>{fallback ?? <DefaultLoading label="Loading…" />}</>;
  }

  if (requireAuth && status === "error") {
    return (
      <div
        role="alert"
        className="grid min-h-dvh place-items-center bg-black p-6 text-center text-white"
      >
        <div className="w-full max-w-sm">
          <p className="text-base font-medium">
            We couldn’t verify your session.
          </p>
          {error && (
            <p className="mt-2 text-sm text-neutral-400">{error.message}</p>
          )}
          <p className="mt-3 text-xs text-neutral-500">
            Taking you back home in a moment so you can sign in again.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={retry}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/85"
            >
              Try again
            </button>
            <Link
              href="/"
              className="rounded-full border border-white/20 px-4 py-2 text-sm transition-colors hover:bg-white/10"
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (requireAuth && status !== "authenticated") {
    return <>{fallback ?? <DefaultLoading label="Redirecting to login…" />}</>;
  }

  return <>{children}</>;
}
