import { Outlet } from "react-router-dom"
import { useInitStore } from "@/common/hooks/use-init-store"
import { useSetCurrentIds } from "@/common/hooks/use-set-current-ids"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { currentIdsActions } from "../store/currentIds.slice"
import { injectEvalSlices, resetEvalSlices } from "../store/slices"

export function EvalRoute() {
  const { initDone } = useInitStore({
    inject: injectEvalSlices,
    reset: resetEvalSlices,
    condition: true,
  })

  if (initDone) return <Route />
  return <LoadingRoute />
}

function Route() {
  useSetCurrentIds(currentIdsActions)
  return <Outlet />
}
