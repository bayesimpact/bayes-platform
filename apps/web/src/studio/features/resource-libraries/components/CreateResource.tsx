import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { generateId } from "@/common/utils/generate-id"
import { StudioRoutes } from "@/studio/routes/helpers"
import type { Resource, ResourceLibrary } from "../resource-libraries.models"
import { addResource } from "../resource-libraries.thunks"
import { ResourceForm } from "./ResourceForm"

function emptyResource(): Resource {
  return { id: generateId(), title: "", description: "", linkType: "url", url: "" }
}

export function CreateResource({ resourceLibrary }: { resourceLibrary: ResourceLibrary }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const initialResource = useMemo(() => emptyResource(), [])

  const editorPath = StudioRoutes.resourceLibrary.build({
    organizationId,
    projectId,
    resourceLibraryId: resourceLibrary.id,
  })

  return (
    <ResourceForm
      initialResource={initialResource}
      headerTitle={t("resourceLibrary:resourceForm.createTitle")}
      submitLabel={t("actions:create")}
      onBack={() => navigate(editorPath)}
      onSubmit={({ id: _id, ...fields }) =>
        dispatch(
          addResource({
            resourceLibraryId: resourceLibrary.id,
            fields,
            onSuccess: () => navigate(editorPath),
          }),
        )
      }
    />
  )
}
