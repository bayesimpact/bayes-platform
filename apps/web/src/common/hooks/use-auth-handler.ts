import { login, logout } from "@/external/oidcClient"

export function useAuthHandler() {
  const handleLogIn = () => login()
  const handleLogOut = () => logout()
  return { handleLogOut, handleLogIn }
}
