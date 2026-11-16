import { queryOptions } from "@tanstack/react-query"
import { appBasePath, appConfig } from "@/app/config"
import { appUpdate } from "@/lib/app-update"
import { publishedBuildSchema } from "../schemas"
import { releaseKeys } from "./keys"

/** A deployment reaches an open tab within about this long, plus the minute that confirms it. */
const POLL_INTERVAL_IN_MILLISECONDS = 60 * 1000

/**
 * The build the server publishes now, in the `version.json` of the Desk's files, polled while the
 * tab is visible and read again when the person comes back to it. Each answer goes to `appUpdate`,
 * which tells a new build from a rolling deployment. A tab with no build id of its own, in dev,
 * the tests or Storybook, polls nothing.
 */
export const publishedBuildQueryOptions = () =>
  queryOptions({
    queryKey: releaseKeys.published(),
    queryFn: async ({ signal }) => {
      // Past the browser's cache, which keeps the Desk's other files for five minutes, and asking
      // the proxies on the way for a fresh answer too.
      const response = await fetch(new URL(`${appBasePath}version.json`, window.location.origin), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
        signal,
      })
      if (!response.ok) throw new Error(`version.json answered ${response.status}`)
      const { buildId } = publishedBuildSchema.parse(await response.json())
      appUpdate.reportPublishedBuild(buildId)
      return buildId
    },
    enabled: appConfig.buildId !== undefined,
    refetchInterval: POLL_INTERVAL_IN_MILLISECONDS,
  })
