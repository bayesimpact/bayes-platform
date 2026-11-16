import { useSyncExternalStore } from "react"
import { appUpdate } from "@/lib/app-update"

/** Whether a newer release of the Desk than this tab's is deployed. */
export function useIsNewReleaseOut(): boolean {
  return useSyncExternalStore(appUpdate.subscribe, appUpdate.isAvailable)
}
