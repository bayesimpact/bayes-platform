import {
  PROJECT_APP_INSTALLATION_READ_PERMISSION,
  PROJECT_APP_INSTALLATION_REVOKE_PERMISSION,
} from "@caseai-connect/api-contracts"
import { useNavigate } from "react-router-dom"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import {
  selectCurrentProjectData,
  selectCurrentProjectId,
} from "@/common/features/projects/projects.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { NotFoundRoute } from "@/common/routes/NotFoundRoute"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { selectAppInstallationsData } from "@/studio/features/app-installations/app-installations.selectors"
import { appInstallationsActions } from "@/studio/features/app-installations/app-installations.slice"
import { revokeProjectAppInstallation } from "@/studio/features/app-installations/app-installations.thunks"
import { AppInstallationsList } from "@/studio/features/app-installations/components/AppInstallationsList"
import { AsyncRoute } from "../../common/routes/AsyncRoute"
import { StudioRoutes } from "./helpers"

export function AppInstallationsRoute() {
  const projectId = useAppSelector(selectCurrentProjectId)
  const project = useAppSelector(selectCurrentProjectData)
  const appInstallations = useAppSelector(selectAppInstallationsData)
  const canRead =
    ADS.isFulfilled(project) &&
    project.value.permissions.includes(PROJECT_APP_INSTALLATION_READ_PERMISSION)

  useMount({
    actions: appInstallationsActions,
    condition: canRead,
    refreshOn: [projectId],
  })

  if (!ADS.isFulfilled(project)) return <LoadingRoute />
  if (!canRead) return <NotFoundRoute />

  return (
    <AsyncRoute data={[appInstallations]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const project = useValue(selectCurrentProjectData)
  const appInstallations = useValue(selectAppInstallationsData)
  const canRevoke = project.permissions.includes(PROJECT_APP_INSTALLATION_REVOKE_PERMISSION)
  return (
    <AppInstallationsList
      appInstallations={appInstallations}
      onBack={() => navigate(StudioRoutes.project.build({ organizationId, projectId }))}
      onRevoke={
        canRevoke
          ? (appInstallationId) => dispatch(revokeProjectAppInstallation({ appInstallationId }))
          : undefined
      }
    />
  )
}
