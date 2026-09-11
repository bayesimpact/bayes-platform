import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom"
import { backofficeRoutes } from "@/backoffice/routes/BackofficeRoutes"
import { HomeRoute } from "@/common/routes/HomeRoute"
import { LogoutRoute } from "@/common/routes/LogoutRoute"
import { McpOauthCallbackRoute } from "@/common/routes/McpOauthCallbackRoute"
import { NotFoundRoute } from "@/common/routes/NotFoundRoute"
import { APP_BASE_PATH } from "@/config/runtime-config"
import { deskRoutes } from "@/desk/routes/DeskRoutes"
import { evalRoutes } from "@/eval/routes/EvalRoutes"
import { reviewerRoutes } from "@/reviewer/routes/ReviewerRoutes"
import { studioRoutes } from "@/studio/routes/StudioRoutes"
import { testerRoutes } from "@/tester/routes/TesterRoutes"
import { RouteNames } from "./helpers"
import { OnboardingRoute } from "./OnboardingRoute"
import { ProtectedRoute } from "./ProtectedRoute"

const router = () =>
  createBrowserRouter(
    [
      {
        path: RouteNames.HOME,
        element: <HomeRoute />,
      },

      {
        path: RouteNames.LOGOUT,
        element: <LogoutRoute />,
      },

      {
        element: (
          <ProtectedRoute>
            <Outlet />
          </ProtectedRoute>
        ),
        children: [
          onboardingRoute,
          mcpOauthCallbackRoute,
          studioRoutes,
          deskRoutes,
          evalRoutes,
          backofficeRoutes,
          testerRoutes,
          reviewerRoutes,
        ],
      },

      {
        path: "*",
        element: <NotFoundRoute />,
      },
    ],
    // `/` unless the build sets VITE_BASE_PATH (see APP_BASE_PATH).
    { basename: APP_BASE_PATH.replace(/\/$/, "") || undefined },
  )

export function Router() {
  return <RouterProvider router={router()} />
}

export const onboardingRoute = {
  path: RouteNames.ONBOARDING,
  element: <OnboardingRoute />,
}

export const mcpOauthCallbackRoute = {
  path: RouteNames.MCP_OAUTH_CALLBACK,
  element: <McpOauthCallbackRoute />,
}
