import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"
import type { RouterContext } from "@/app/router-context"
import { NotFoundState } from "@/components/shared/NotFoundState"
import { RouteErrorState } from "@/components/shared/RouteErrorState"

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  // The global error boundary: an error no route below handles lands here.
  errorComponent: RouteErrorState,
  notFoundComponent: NotFoundState,
})
