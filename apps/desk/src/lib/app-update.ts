import { appConfig } from "@/app/config"

/**
 * How long another release must answer alone before it counts as new. During a rolling deployment,
 * the old and the new release answer side by side: a tab of the new one also sees the old one,
 * which it must not announce. Once the deployment ends, only the new release answers.
 */
const CONFIRMATION_DELAY_IN_MILLISECONDS = 60 * 1000

/**
 * Follows whether a newer release of the Desk than the one this tab runs is deployed.
 * `runningVersion` is undefined where nothing is deployed, as in local dev: no release then counts
 * as new.
 */
export function createAppUpdate(runningVersion: string | undefined) {
  let isAvailable = false
  // When a response of another release came first, since the last one of this tab's release.
  let otherReleaseSince: number | null = null
  const listeners = new Set<() => void>()

  const setAvailable = (nextIsAvailable: boolean) => {
    if (isAvailable === nextIsAvailable) return
    isAvailable = nextIsAvailable
    for (const listener of listeners) listener()
  }
  const markAvailable = () => setAvailable(true)

  return {
    /** Whether a new release is deployed, for `useSyncExternalStore`. */
    isAvailable: () => isAvailable,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /**
     * Reads the release that answered a request of the API, from its `X-App-Version` header.
     * Another release counts as new once it alone answered for a minute.
     */
    reportServerVersion: (serverVersion: string | null) => {
      if (!serverVersion || !runningVersion) return
      if (serverVersion === runningVersion) {
        otherReleaseSince = null
        return
      }
      const now = Date.now()
      if (otherReleaseSince === null) otherReleaseSince = now
      if (now - otherReleaseSince >= CONFIRMATION_DELAY_IN_MILLISECONDS) markAvailable()
    },
    /**
     * A file of this tab's release is gone from the server: the release no longer runs anywhere,
     * so a new one is out at once.
     */
    reportStaleBuild: markAvailable,
    /** Forgets the new release, as a new tab: each test starts from one. */
    reset: () => {
      otherReleaseSince = null
      setAvailable(false)
    },
  }
}

/** The release of this tab against the API's: the deployed tag, else the commit. */
export const appUpdate = createAppUpdate(appConfig.appVersion ?? appConfig.gitSha)
