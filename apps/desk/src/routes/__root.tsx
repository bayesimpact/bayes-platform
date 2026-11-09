import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"
import type { RouterContext } from "@/app/router-context"
import { NotFoundState } from "@/components/shared/NotFoundState"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { useReloadWhenSafe } from "@/hooks/use-reload-when-safe"

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  // The global error boundary: an error no route below handles lands here.
  errorComponent: RouteErrorState,
  notFoundComponent: NotFoundState,
})

function RootLayout() {
  // Every page of the Desk follows the releases, and reloads into a new one when it is safe.
  useReloadWhenSafe()
  return <Outlet />
}
