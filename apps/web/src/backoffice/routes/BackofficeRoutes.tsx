import { Navigate } from "react-router-dom"
import { BackofficeOrganizationsRoute } from "./BackofficeOrganizationsRoute"
import { BackofficeProjectDetailRoute } from "./BackofficeProjectDetailRoute"
import { BackofficeProjectsListRoute } from "./BackofficeProjectsListRoute"
import { BackofficeRoute } from "./BackofficeRoute"
import { BackofficeTermsRoute } from "./BackofficeTermsRoute"
import { BackofficeUserDetailRoute } from "./BackofficeUserDetailRoute"
import { BackofficeUsersListRoute } from "./BackofficeUsersListRoute"
import { BackofficeRoutes } from "./helpers"

export const backofficeRoutes = {
  path: BackofficeRoutes.home.path,
  element: <BackofficeRoute />,
  children: [
    {
      index: true,
      element: <Navigate to="organizations" replace />,
    },
    {
      path: "organizations",
      element: <BackofficeOrganizationsRoute />,
    },
    {
      path: "projects",
      element: <BackofficeProjectsListRoute />,
    },
    {
      path: "projects/:projectId",
      element: <BackofficeProjectDetailRoute />,
    },
    {
      path: "users",
      element: <BackofficeUsersListRoute />,
    },
    {
      path: "users/:userId",
      element: <BackofficeUserDetailRoute />,
    },
    {
      path: "terms",
      element: <BackofficeTermsRoute />,
    },
  ],
}
