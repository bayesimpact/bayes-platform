import { Navigate } from "react-router-dom"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppSelector } from "@/common/store/hooks"
import { CreateResource } from "@/studio/features/resource-libraries/components/CreateResource"
import {
  selectCurrentResourceLibraryId,
  selectResourceLibrariesData,
} from "@/studio/features/resource-libraries/resource-libraries.selectors"
import { StudioRoutes } from "./helpers"

export function ResourceCreatorRoute() {
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const resourceLibraryId = useAppSelector(selectCurrentResourceLibraryId)
  const data = useValue(selectResourceLibrariesData)

  if (!resourceLibraryId) return <LoadingRoute />

  const resourceLibrary = data.find((library) => library.id === resourceLibraryId)
  if (!resourceLibrary) {
    return (
      <Navigate to={StudioRoutes.resourceLibraries.build({ organizationId, projectId })} replace />
    )
  }

  return <CreateResource resourceLibrary={resourceLibrary} />
}
