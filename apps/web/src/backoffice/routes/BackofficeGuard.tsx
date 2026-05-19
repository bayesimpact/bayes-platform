import { selectIsBackofficeAuthorized } from "@/common/features/me/me.selectors"
import { useInitStore } from "@/common/hooks/use-init-store"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { NotFoundRoute } from "@/common/routes/NotFoundRoute"
import { useAppSelector } from "@/common/store/hooks"
import { injectBackofficeSlices, resetBackofficeSlices } from "../store/slices"

export function BackofficeGuard({ children }: { children: React.ReactNode }) {
  const isBackofficeAuthorized = useAppSelector(selectIsBackofficeAuthorized)

  const { initDone } = useInitStore({
    inject: injectBackofficeSlices,
    reset: resetBackofficeSlices,
    condition: isBackofficeAuthorized,
  })

  if (isBackofficeAuthorized) {
    if (initDone) return <>{children}</>
    return <LoadingRoute />
  }
  return <NotFoundRoute />
}
