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
    scrollRestoration: true,
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
