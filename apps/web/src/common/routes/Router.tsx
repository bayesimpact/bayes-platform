import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom"
import { backofficeRoutes } from "@/backoffice/routes/BackofficeRoutes"
import { HomeRoute } from "@/common/routes/HomeRoute"
import { LogoutRoute } from "@/common/routes/LogoutRoute"
import { McpOauthCallbackRoute } from "@/common/routes/McpOauthCallbackRoute"
import { NotFoundRoute } from "@/common/routes/NotFoundRoute"
import { OAuthAuthorizeRoute } from "@/common/routes/OAuthAuthorizeRoute"
import { APP_BASE_PATH } from "@/config/runtime-config"
import { studioRoutes } from "@/studio/routes/StudioRoutes"
import { RouteNames } from "./helpers"
import { LegacyCampaignRoute } from "./LegacyCampaignRoute"
import { LEGACY_CAMPAIGN_APP_PATHS } from "./legacy-campaign-urls"
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
          oauthAuthorizeRoute,
          studioRoutes,
          backofficeRoutes,
        ],
      },

      // The Evaluation app signs the person in itself, so these stay outside the protected routes.
      ...LEGACY_CAMPAIGN_APP_PATHS.map((path) => ({
        path: `${path}/*`,
        element: <LegacyCampaignRoute />,
      })),

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

export const oauthAuthorizeRoute = {
  path: RouteNames.OAUTH_AUTHORIZE,
  element: <OAuthAuthorizeRoute />,
}
