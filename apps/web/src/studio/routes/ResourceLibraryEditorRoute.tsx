import { Navigate, useOutlet } from "react-router-dom"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppSelector } from "@/common/store/hooks"
import {
  selectCurrentResourceLibraryId,
  selectResourceLibrariesData,
} from "@/studio/features/resource-libraries/resource-libraries.selectors"
import { EditResourceLibrary } from "../features/resource-libraries/components/EditResourceLibrary"
import { StudioRoutes } from "./helpers"

export function ResourceLibraryEditorRoute() {
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const resourceLibraryId = useAppSelector(selectCurrentResourceLibraryId)
  const data = useValue(selectResourceLibrariesData)
  const outlet = useOutlet()

  if (!resourceLibraryId) return <LoadingRoute />

  const resourceLibrary = data.find((library) => library.id === resourceLibraryId)
  if (!resourceLibrary) {
    return (
      <Navigate to={StudioRoutes.resourceLibraries.build({ organizationId, projectId })} replace />
    )
  }

  // A nested resource create/edit route takes over the page when present.
  if (outlet) return outlet

  return <EditResourceLibrary resourceLibrary={resourceLibrary} />
}
