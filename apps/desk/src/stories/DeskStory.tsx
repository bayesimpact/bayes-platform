import { createMemoryHistory } from "@tanstack/react-router"
import { useState } from "react"
import { AppProviders } from "@/app/providers"
import { createQueryClient } from "@/app/query-client"
import { createAppRouter } from "@/app/router"

export type DeskStoryProps = {
  /** The page the Desk opens on; the person goes anywhere from there. */
  url: string
}

/** The whole Desk at a URL, with a router and a cache of its own, on the mocked API. */
export function DeskStory({ url }: DeskStoryProps) {
  const [app] = useState(() => {
    const queryClient = createQueryClient()
    const router = createAppRouter(queryClient, {
      history: createMemoryHistory({ initialEntries: [url] }),
    })
    return { queryClient, router }
  })
  return <AppProviders queryClient={app.queryClient} router={app.router} />
}
