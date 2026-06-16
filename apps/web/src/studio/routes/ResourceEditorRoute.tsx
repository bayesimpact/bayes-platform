import { Navigate } from "react-router-dom"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppSelector } from "@/common/store/hooks"
import { EditResource } from "@/studio/features/resource-libraries/components/EditResource"
import {
  selectCurrentResourceId,
  selectCurrentResourceLibraryId,
  selectResourceLibrariesData,
} from "@/studio/features/resource-libraries/resource-libraries.selectors"
import { StudioRoutes } from "./helpers"

export function ResourceEditorRoute() {
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const resourceLibraryId = useAppSelector(selectCurrentResourceLibraryId)
  const resourceId = useAppSelector(selectCurrentResourceId)
  const data = useValue(selectResourceLibrariesData)

  if (!resourceLibraryId || !resourceId) return <LoadingRoute />

  const resourceLibrary = data.find((library) => library.id === resourceLibraryId)
  if (!resourceLibrary) {
    return (
      <Navigate to={StudioRoutes.resourceLibraries.build({ organizationId, projectId })} replace />
    )
  }

  const resource = resourceLibrary.resources.find((item) => item.id === resourceId)
  if (!resource) {
    return (
      <Navigate
        to={StudioRoutes.resourceLibrary.build({ organizationId, projectId, resourceLibraryId })}
        replace
      />
    )
  }

  return <EditResource resourceLibrary={resourceLibrary} resource={resource} />
}
