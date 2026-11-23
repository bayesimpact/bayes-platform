import { createMemoryHistory } from "@tanstack/react-router"
import { useState } from "react"
import { AppProviders } from "@/app/providers"
import { createQueryClient } from "@/app/query-client"
import { createAppRouter } from "@/app/router"

export type EvalStoryProps = {
  /** The page the app opens on; the person goes anywhere from there. */
  url: string
}

/**
 * The whole app at a URL, with a router and a cache of its own, on the mocked API. Queries do not
 * retry, so a failure shows at once.
 */
export function EvalStory({ url }: EvalStoryProps) {
  const [app] = useState(() => {
    const queryClient = createQueryClient({ isRetrying: false })
    const router = createAppRouter(queryClient, {
      history: createMemoryHistory({ initialEntries: [url] }),
    })
    return { queryClient, router }
  })
  return <AppProviders queryClient={app.queryClient} router={app.router} />
}
