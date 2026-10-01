import { DOCUMENT_SOURCE_READ_PERMISSION } from "@caseai-connect/api-contracts"
import {
  selectCurrentProjectData,
  selectCurrentProjectId,
} from "@/common/features/projects/projects.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { NotFoundRoute } from "@/common/routes/NotFoundRoute"
import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"
import { ExternalSourcesList } from "@/studio/features/document-sources/components/ExternalSourcesList"
import { selectDocumentSourcesData } from "@/studio/features/document-sources/document-sources.selectors"
import { documentSourcesActions } from "@/studio/features/document-sources/document-sources.slice"
import { AsyncRoute } from "../../common/routes/AsyncRoute"

export function ExternalSourcesRoute() {
  const projectId = useAppSelector(selectCurrentProjectId)
  const project = useAppSelector(selectCurrentProjectData)
  const documentSources = useAppSelector(selectDocumentSourcesData)
  const canRead =
    ADS.isFulfilled(project) && project.value.permissions.includes(DOCUMENT_SOURCE_READ_PERMISSION)

  useMount({
    actions: documentSourcesActions,
    condition: canRead,
    refreshOn: [projectId],
  })

  if (!ADS.isFulfilled(project)) return <LoadingRoute />
  if (!canRead) return <NotFoundRoute />

  return (
    <AsyncRoute data={[documentSources]}>
      <ExternalSourcesList />
    </AsyncRoute>
  )
}
