import Keycloak from "keycloak-js";

let instance: Keycloak | null = null;
let initPromise: Promise<boolean> | null = null;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/** Browser-only Keycloak singleton. Throws on the server instead of returning a fake object. */
export function getKeycloakInstance(): Keycloak {
  if (typeof window === "undefined") {
    throw new Error("Keycloak can only be used in the browser.");
  }

  if (!instance) {
    instance = new Keycloak({
      url: requireEnv(
        "NEXT_PUBLIC_KEYCLOAK_URL",
        process.env.NEXT_PUBLIC_KEYCLOAK_URL,
      ),
      realm: requireEnv(
        "NEXT_PUBLIC_KEYCLOAK_REALM",
        process.env.NEXT_PUBLIC_KEYCLOAK_REALM,
      ),
      clientId: requireEnv(
        "NEXT_PUBLIC_KEYCLOAK_CLIENT_ID",
        process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID,
      ),
    });
  }
  return instance;
}

/**
 * Initializes Keycloak exactly once, even with React StrictMode
 * (which runs effects twice in development).
 */
export function initKeycloak(): Promise<boolean> {
  if (!initPromise) {
    initPromise = getKeycloakInstance()
      .init({
        onLoad: "check-sso", // detect existing session without forcing a login redirect
        pkceMethod: "S256",
        checkLoginIframe: false,
      })
      .catch((err) => {
        initPromise = null; // allow retry after a failure
        throw err;
      });
  }
  return initPromise;
}

/** Query params Keycloak appends to the URL after a login round-trip. */
const CALLBACK_PARAMS = [
  "code",
  "state",
  "session_state",
  "error",
  "error_description",
  "error_uri",
  "iss",
];

/**
 * Removes a login callback from the address bar.
 *
 * After a failed exchange that `code` is dead, and leaving it there makes
 * "try again" (or a reload) replay a callback that can never succeed.
 */
export function stripAuthParams(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of CALLBACK_PARAMS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  // Older adapters (and some proxies) return the callback in the fragment.
  if (url.hash.length > 1) {
    const hash = new URLSearchParams(url.hash.slice(1));
    let hashChanged = false;
    for (const key of CALLBACK_PARAMS) {
      if (hash.has(key)) {
        hash.delete(key);
        hashChanged = true;
      }
    }
    if (hashChanged) {
      url.hash = hash.toString();
      changed = true;
    }
  }
  if (changed) window.history.replaceState(null, "", url.toString());
}

/**
 * Forgets the one-shot init and its stored callback, so the next attempt
 * starts a clean `check-sso` instead of replaying a consumed login.
 *
 * keycloak-js throws if `init()` is called twice on the same instance, so the
 * instance is dropped here and rebuilt on the next `getKeycloakInstance()`.
 */
export function resetKeycloak(): void {
  initPromise = null;
  instance = null;
  if (typeof window === "undefined") return;
  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (const key of Object.keys(storage)) {
        if (key.startsWith("kc-callback-")) storage.removeItem(key);
      }
    }
  } catch {
    // Storage can be blocked; clearing the URL is still worth it.
  }
}
