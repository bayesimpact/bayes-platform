import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { useEffect } from "react"
import { appUpdate } from "@/lib/app-update"
import { useIsNewReleaseOut } from "./use-is-new-release-out"

/**
 * Follows the releases of the Desk, and brings a new one in where nothing is lost: the next move
 * to another page becomes a full load of that page. Until then, `NewReleaseBanner` lets the
 * person reload when they choose.
 */
export function useReloadWhenSafe(): void {
  const router = useRouter()
  const queryClient = useQueryClient()
  const isNewReleaseOut = useIsNewReleaseOut()

  // Vite fires this when a chunk of this tab's release is gone from the server: a new release
  // replaced it. The page that needed it fails, and its error page offers the reload.
  useEffect(() => {
    const handlePreloadError = () => appUpdate.reportStaleBuild()
    window.addEventListener("vite:preloadError", handlePreloadError)
    return () => window.removeEventListener("vite:preloadError", handlePreloadError)
  }, [])

  useEffect(() => {
    if (!isNewReleaseOut) return
    // The router already wrote the new URL, which the reload loads. A request that changes data,
    // such as an upload or the first message of a conversation, keeps the move a client one.
    return router.subscribe("onBeforeNavigate", (event) => {
      if (event.pathChanged && queryClient.isMutating() === 0) window.location.reload()
    })
  }, [isNewReleaseOut, router, queryClient])
}
