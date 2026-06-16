import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { StudioRoutes } from "@/studio/routes/helpers"
import type { Resource, ResourceLibrary } from "../resource-libraries.models"
import { updateResourceLibrary } from "../resource-libraries.thunks"
import { ResourceForm } from "./ResourceForm"

export function EditResource({
  resourceLibrary,
  resource,
}: {
  resourceLibrary: ResourceLibrary
  resource: Resource
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)

  const editorPath = StudioRoutes.resourceLibrary.build({
    organizationId,
    projectId,
    resourceLibraryId: resourceLibrary.id,
  })

  return (
    <ResourceForm
      initialResource={resource}
      headerTitle={resource.title || t("resourceLibrary:resourceForm.editTitle")}
      submitLabel={t("actions:save")}
      onBack={() => navigate(editorPath)}
      onSubmit={(next) =>
        dispatch(
          updateResourceLibrary({
            resourceLibraryId: resourceLibrary.id,
            fields: {
              title: resourceLibrary.title,
              resources: resourceLibrary.resources.map((item) =>
                item.id === next.id ? next : item,
              ),
            },
            onSuccess: () => navigate(editorPath),
          }),
        )
      }
    />
  )
}
