import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { StudioRoutes } from "@/studio/routes/helpers"
import { createResourceLibrary } from "../resource-libraries.thunks"
import { ResourceLibraryTitleForm } from "./ResourceLibraryTitleForm"

export function CreateResourceLibrary() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const managerPath = StudioRoutes.resourceLibraries.build({ organizationId, projectId })

  return (
    <div className="flex flex-col">
      <GridHeader
        onBack={() => navigate(managerPath)}
        title={t("resourceLibrary:create.title")}
        description={t("resourceLibrary:description")}
      />

      <div className="bg-white p-6">
        <ResourceLibraryTitleForm
          defaultTitle=""
          isLoading={false}
          submitLabel={t("actions:create")}
          onSubmit={(title) =>
            dispatch(
              createResourceLibrary({
                fields: { title },
                onSuccess: (library) =>
                  navigate(
                    StudioRoutes.resourceLibrary.build({
                      organizationId,
                      projectId,
                      resourceLibraryId: library.id,
                    }),
                  ),
              }),
            )
          }
        />
      </div>
    </div>
  )
}
