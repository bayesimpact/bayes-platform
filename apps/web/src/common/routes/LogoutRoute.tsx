import { useAuth0 } from "@auth0/auth0-react"
import { getAppUrl } from "@/config/runtime-config"
import { LoadingRoute } from "./LoadingRoute"

export function LogoutRoute() {
  const { logout } = useAuth0()
  logout({ logoutParams: { returnTo: getAppUrl() } })
  return <LoadingRoute />
}
