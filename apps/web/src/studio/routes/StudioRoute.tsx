import { Outlet } from "react-router-dom"
import { useInitStore } from "@/common/hooks/use-init-store"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { injectStudioSlices, resetStudioSlices } from "../store/slices"

export function StudioRoute() {
  const { initDone } = useInitStore({
    inject: injectStudioSlices,
    reset: resetStudioSlices,
    condition: true,
  })

  if (initDone) return <Outlet />
  return <LoadingRoute />
}
