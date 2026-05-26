import { Outlet } from "react-router-dom"
import { useInitStore } from "@/common/hooks/use-init-store"
import { useSetCurrentIds } from "@/common/hooks/use-set-current-ids"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { currentIdsActions } from "../store/currentIds.slice"
import { injectDeskSlices, resetDeskSlices } from "../store/slices"

export function DeskRoute() {
  const { initDone } = useInitStore({
    inject: injectDeskSlices,
    reset: resetDeskSlices,
    condition: true,
  })

  if (initDone) return <Route />
  return <LoadingRoute />
}

function Route() {
  useSetCurrentIds(currentIdsActions)
  return <Outlet />
}
