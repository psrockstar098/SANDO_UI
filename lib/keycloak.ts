import Keycloak from "keycloak-js";

let keycloakInstance: Keycloak | null = null;

export function getKeycloakInstance(): Keycloak {
  if (typeof window === "undefined") {
    return {} as Keycloak;
  }

  if (!keycloakInstance) {
    keycloakInstance = new Keycloak({
      url: process.env.NEXT_PUBLIC_KEYCLOAK_URL!,
      realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM!,
      clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID!,
    });
  }

  return keycloakInstance;
}
