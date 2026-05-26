import { Outlet } from "react-router-dom"
import { useInitStore } from "@/common/hooks/use-init-store"
import { useSetCurrentIds } from "@/common/hooks/use-set-current-ids"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { currentIdsActions } from "../store/currentIds.slice"
import { injectStudioSlices, resetStudioSlices } from "../store/slices"
import { RestrictedAccess } from "./RestrictedAccess"

export function StudioRoute() {
  const { initDone } = useInitStore({
    inject: injectStudioSlices,
    reset: resetStudioSlices,
    condition: true,
  })

  if (initDone) return <Route />
  return <LoadingRoute />
}

function Route() {
  useSetCurrentIds(currentIdsActions)
  return (
    <RestrictedAccess ability="canAccessStudio">
      <Outlet />
    </RestrictedAccess>
  )
}
