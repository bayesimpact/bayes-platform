import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import {
  selectIsBackofficeAuthorized,
  selectIsTermsManagementAuthorized,
} from "@/common/features/me/me.selectors"
import { useInitStore } from "@/common/hooks/use-init-store"
import { useMount } from "@/common/hooks/use-mount"
import { RouteNames } from "@/common/routes/helpers"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { NotFoundRoute } from "@/common/routes/NotFoundRoute"
import { useAppSelector } from "@/common/store/hooks"
import { backofficeActions } from "../features/backoffice/backoffice.slice"
import { injectBackofficeSlices, resetBackofficeSlices } from "../store/slices"
import { BackofficeAgentRoutes, BackofficeProjectRoutes, BackofficeUserRoutes } from "./helpers"

export function BackofficeRoute() {
  const isAuthorized = useAppSelector(selectIsBackofficeAuthorized)
  const { initDone } = useInitStore({
    inject: injectBackofficeSlices,
    reset: resetBackofficeSlices,
    condition: isAuthorized,
  })

  if (!isAuthorized) return <NotFoundRoute />
  if (initDone) return <Layout />
  return <LoadingRoute />
}

function Layout() {
  const navigate = useNavigate()
  const canManageTerms = useAppSelector(selectIsTermsManagementAuthorized)

  useMount({ actions: backofficeActions })

  return (
    <div className="w-4/5 lg:w-3/4 mx-auto my-10 relative border rounded-2xl overflow-hidden">
      <GridHeader
        onBack={() => navigate(RouteNames.ONBOARDING)}
        title="Backoffice"
        description="Manage organizations, projects, feature flags, and users"
      />
      <nav className="p-4 border-b flex gap-2">
        <NavLink
          to="organizations"
          className={({ isActive }) =>
            `px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`
          }
        >
          Organizations
        </NavLink>
        <NavLink
          to={BackofficeProjectRoutes.projects.path.replace("/backoffice/", "")}
          className={({ isActive }) =>
            `px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`
          }
        >
          Projects
        </NavLink>
        <NavLink
          to={BackofficeAgentRoutes.agents.path.replace("/backoffice/", "")}
          className={({ isActive }) =>
            `px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`
          }
        >
          Agents
        </NavLink>
        <NavLink
          to={BackofficeUserRoutes.users.path.replace("/backoffice/", "")}
          className={({ isActive }) =>
            `px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`
          }
        >
          Users
        </NavLink>
        {canManageTerms && (
          <NavLink
            to="terms"
            className={({ isActive }) =>
              `px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`
            }
          >
            Terms & Compliance
          </NavLink>
        )}
      </nav>
      <Outlet />
    </div>
  )
}
