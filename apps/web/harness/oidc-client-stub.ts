// Replaces @/external/oidcClient (see vite.config.ts): no identity provider is contacted.
export class AuthenticationRequiredError extends Error {}

export async function getAccessToken(): Promise<string> {
  return "harness-token"
}

export async function login(): Promise<void> {}

export async function logout(): Promise<void> {}
