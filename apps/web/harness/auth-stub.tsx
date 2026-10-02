import type { ReactNode } from "react"

// Replaces react-oidc-context (see vite.config.ts): the user is always signed in.
const auth = {
  isAuthenticated: true,
  isLoading: false,
  error: undefined,
  user: { profile: { sub: "harness-user" }, access_token: "harness-token", expired: false },
  activeNavigator: undefined,
  signinRedirect: async () => {},
  signoutRedirect: async () => {},
  removeUser: async () => {},
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function useAuth() {
  return auth
}
