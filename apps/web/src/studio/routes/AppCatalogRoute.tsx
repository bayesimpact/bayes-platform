import {
  PROJECT_APP_INSTALLATION_CREATE_PERMISSION,
  PROJECT_APP_INSTALLATION_READ_PERMISSION,
} from "@caseai-connect/api-contracts"
import { useNavigate } from "react-router-dom"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import {
  selectCurrentProjectData,
  selectCurrentProjectId,
} from "@/common/features/projects/projects.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppSelector } from "@/common/store/hooks"
import { selectAppCatalogData } from "@/studio/features/app-catalog/app-catalog.selectors"
import { appCatalogActions } from "@/studio/features/app-catalog/app-catalog.slice"
import { AppCatalogList } from "@/studio/features/app-catalog/components/AppCatalogList"
import { StudioRoutes } from "./helpers"

/** Wrapped in the apps-catalog RestrictedFeature: every project member reaches it. */
export function AppCatalogRoute() {
  const projectId = useAppSelector(selectCurrentProjectId)
  const appCatalog = useAppSelector(selectAppCatalogData)

  useMount({ actions: appCatalogActions, condition: !!projectId, refreshOn: [projectId] })

  return (
    <AsyncRoute data={[appCatalog]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const navigate = useNavigate()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const project = useValue(selectCurrentProjectData)
  const entries = useValue(selectAppCatalogData)
  const canInstall = project.permissions.includes(PROJECT_APP_INSTALLATION_CREATE_PERMISSION)
  const canSeeInstallations = project.permissions.includes(PROJECT_APP_INSTALLATION_READ_PERMISSION)
  return (
    <AppCatalogList
      entries={entries}
      canInstall={canInstall}
      onBack={() =>
        navigate(
          canSeeInstallations
            ? StudioRoutes.appInstallations.build({ organizationId, projectId })
            : StudioRoutes.project.build({ organizationId, projectId }),
        )
      }
    />
  )
}
