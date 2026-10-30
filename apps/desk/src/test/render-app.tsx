import { createMemoryHistory } from "@tanstack/react-router"
import { render } from "@testing-library/react"
import { onTestFinished } from "vitest"
import { AppProviders } from "@/app/providers"
import { createQueryClient } from "@/app/query-client"
import { createAppRouter } from "@/app/router"
import { onSessionEnded } from "@/lib/auth/session"

/**
 * Renders the whole Desk at a URL, on the mocked API, as `main.tsx` starts it. Queries do not
 * retry, so errors show at once.
 */
export function renderApp(url = "/app/") {
  const queryClient = createQueryClient({ isRetrying: false })
  const router = createAppRouter(queryClient, {
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  // A session that ends takes its data with it, as in main.tsx.
  const stopListening = onSessionEnded(() => {
    queryClient.clear()
    void router.invalidate()
  })
  onTestFinished(stopListening)
  render(<AppProviders queryClient={queryClient} router={router} />)
  return { queryClient, router }
}
