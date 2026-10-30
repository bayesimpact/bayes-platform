import type { QueryClient } from "@tanstack/react-query"
import { createRouter, type RouterHistory } from "@tanstack/react-router"
import { routeTree } from "@/routeTree.gen"
import { appBasePath } from "./config"

/** The Desk's router. Tests pass a memory history; the browser's is the default. */
export function createAppRouter(
  queryClient: QueryClient,
  options: { history?: RouterHistory } = {},
) {
  return createRouter({
    routeTree,
    ...options,
    basepath: appBasePath.replace(/\/$/, ""),
    context: { queryClient },
    // TanStack Query alone decides when data is fresh.
    defaultPreloadStaleTime: 0,
    // A page that loads in less than 200 ms opens at once; a slower one shows its skeleton then,
    // rather than the router's second of blank page, and keeps it 300 ms so it does not flicker.
    defaultPendingMs: 200,
    defaultPendingMinMs: 300,
    scrollRestoration: true,
  })
}

declare module "@tanstack/react-router" {
  // biome-ignore lint/style/useConsistentTypeDefinitions: it augments a declaration, which only an interface can.
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
