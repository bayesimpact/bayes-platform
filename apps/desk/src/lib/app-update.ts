import { appConfig } from "@/app/config"

/**
 * How long another build must be the one published alone before it counts as new. During a rolling
 * deployment, the servers of the old and the new release answer side by side: a tab of the new
 * build also reads the old one, which it must not announce. Once the deployment ends, only the new
 * build is published.
 */
const CONFIRMATION_DELAY_IN_MILLISECONDS = 60 * 1000

/**
 * Follows whether a newer build of the Desk than the one this tab runs is deployed. `runningBuildId`
 * is undefined where nothing is deployed, as in dev: no build then counts as new.
 */
export function createAppUpdate(runningBuildId: string | undefined) {
  let isAvailable = false
  // When another build was first read, since the last time this tab's own build was.
  let otherBuildSince: number | null = null
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
     * Reads the build that `version.json` publishes now. Another build counts as new once it alone
     * was published for a minute.
     */
    reportPublishedBuild: (publishedBuildId: string) => {
      if (!runningBuildId) return
      if (publishedBuildId === runningBuildId) {
        otherBuildSince = null
        return
      }
      const now = Date.now()
      if (otherBuildSince === null) otherBuildSince = now
      if (now - otherBuildSince >= CONFIRMATION_DELAY_IN_MILLISECONDS) markAvailable()
    },
    /**
     * A file of this tab's release is gone from the server: the release no longer runs anywhere,
     * so a new one is out at once.
     */
    reportStaleBuild: markAvailable,
    /** Forgets the new release, as a new tab: each test starts from one. */
    reset: () => {
      otherBuildSince = null
      setAvailable(false)
    },
  }
}

/** This tab's build against the one its server publishes. */
export const appUpdate = createAppUpdate(appConfig.buildId)
