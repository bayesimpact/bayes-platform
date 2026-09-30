import { useEffect } from "react"
import { logout } from "@/external/oidcClient"
import { LoadingRoute } from "./LoadingRoute"

export function LogoutRoute() {
  useEffect(() => {
    logout()
  }, [])
  return <LoadingRoute />
}
