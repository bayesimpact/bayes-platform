import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom"
import { backofficeRoutes } from "@/backoffice/routes/BackofficeRoutes"
import { HomeRoute } from "@/common/routes/HomeRoute"
import { LogoutRoute } from "@/common/routes/LogoutRoute"
import { NotFoundRoute } from "@/common/routes/NotFoundRoute"
import { deskRoutes } from "@/desk/routes/DeskRoutes"
import { evalRoutes } from "@/eval/routes/EvalRoutes"
import { reviewerRoutes } from "@/reviewer/routes/ReviewerRoutes"
import { studioRoutes } from "@/studio/routes/StudioRoutes"
import { testerRoutes } from "@/tester/routes/TesterRoutes"
import { RouteNames } from "./helpers"
import { OnboardingRoute } from "./OnboardingRoute"
import { ProtectedRoute } from "./ProtectedRoute"

const router = () =>
  createBrowserRouter([
    {
      path: RouteNames.HOME,
      element: <HomeRoute />,
    },
    {
      path: RouteNames.ONBOARDING,
      element: (
        <ProtectedRoute>
          <OnboardingRoute />
        </ProtectedRoute>
      ),
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
  ])

export function Router() {
  return <RouterProvider router={router()} />
}
