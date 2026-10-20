import { QueryClient } from "@tanstack/react-query"
import { createMemoryHistory } from "@tanstack/react-router"
import { render } from "@testing-library/react"
import { AppProviders } from "@/app/providers"
import { createAppRouter } from "@/app/router"

/** Renders the whole Desk at a URL, on the mocked API. Queries do not retry, so errors show at once. */
export function renderApp(url = "/app/") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter(queryClient, {
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  render(<AppProviders queryClient={queryClient} router={router} />)
  return { queryClient, router }
}
