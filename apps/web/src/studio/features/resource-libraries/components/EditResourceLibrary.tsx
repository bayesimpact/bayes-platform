import { Button } from "@caseai-connect/ui/shad/button"
import { Field, FieldLabel } from "@caseai-connect/ui/shad/field"
import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { StudioRoutes } from "@/studio/routes/helpers"
import type { Resource, ResourceLibrary } from "../resource-libraries.models"
import { updateResourceLibrary } from "../resource-libraries.thunks"
import { ResourceLibraryTitleForm } from "./ResourceLibraryTitleForm"
import { ResourcesTable } from "./ResourcesTable"

export function EditResourceLibrary({ resourceLibrary }: { resourceLibrary: ResourceLibrary }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const managerPath = StudioRoutes.resourceLibraries.build({ organizationId, projectId })

  const [deletingResource, setDeletingResource] = useState<Resource | null>(null)

  const { resources, title } = resourceLibrary

  const save = (fields: { title: string; resources: Resource[] }) => {
    dispatch(
      updateResourceLibrary({ resourceLibraryId: resourceLibrary.id, fields, onSuccess: () => {} }),
    )
  }

  const removeResource = (resourceId: string) => {
    save({ title, resources: resources.filter((resource) => resource.id !== resourceId) })
    setDeletingResource(null)
  }

  return (
    <div className="flex flex-col">
      <GridHeader
        onBack={() => navigate(managerPath)}
        title={title}
        description={t("resourceLibrary:description")}
        action={
          <Button
            type="button"
            variant="default"
            onClick={() =>
              navigate(
                StudioRoutes.resourceNew.build({
                  organizationId,
                  projectId,
                  resourceLibraryId: resourceLibrary.id,
                }),
              )
            }
          >
            <PlusIcon className="size-4" /> {t("actions:add")}
          </Button>
        }
      />

      <div className="flex flex-col gap-6 bg-white p-6">
        <ResourceLibraryTitleForm
          key={title}
          defaultTitle={title}
          isLoading={false}
          submitLabel={t("actions:save")}
          onSubmit={(nextTitle) => save({ title: nextTitle, resources })}
        />

        <Field>
          <FieldLabel>{t("resourceLibrary:form.resources")}</FieldLabel>
          {resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("resourceLibrary:form.noResources")}</p>
          ) : (
            <ResourcesTable
              resources={resources}
              organizationId={organizationId}
              projectId={projectId}
              resourceLibraryId={resourceLibrary.id}
              onEdit={(resource) =>
                navigate(
                  StudioRoutes.resource.build({
                    organizationId,
                    projectId,
                    resourceLibraryId: resourceLibrary.id,
                    resourceId: resource.id,
                  }),
                )
              }
              onDelete={setDeletingResource}
            />
          )}
        </Field>
      </div>

      <ConfirmDialog
        open={deletingResource !== null}
        title={t("resourceLibrary:removeResource.title")}
        description={
          deletingResource
            ? t("resourceLibrary:removeResource.description", { title: deletingResource.title })
            : undefined
        }
        onCancel={() => setDeletingResource(null)}
        onConfirm={() => deletingResource && removeResource(deletingResource.id)}
      />
    </div>
  )
}
