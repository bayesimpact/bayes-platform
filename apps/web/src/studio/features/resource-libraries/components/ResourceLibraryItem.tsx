import { Button } from "@caseai-connect/ui/shad/button"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { GridCard } from "@/common/components/grid/Grid"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { StudioRoutes } from "@/studio/routes/helpers"
import type { ResourceLibrary } from "../resource-libraries.models"
import { deleteResourceLibrary } from "../resource-libraries.thunks"

export function ResourceLibraryItem({ resourceLibrary }: { resourceLibrary: ResourceLibrary }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const editPath = StudioRoutes.resourceLibrary.build({
    organizationId,
    projectId,
    resourceLibraryId: resourceLibrary.id,
  })

  const resourceCount = resourceLibrary.resources.length

  return (
    <>
      <GridCard>
        <GridCard.TopAction>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("actions:delete")}
            onClick={() => setIsConfirmingDelete(true)}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </GridCard.TopAction>
        <GridCard.Body>
          <GridCard.Title>{resourceLibrary.title}</GridCard.Title>
          <GridCard.Description>
            {t("resourceLibrary:resourceCount", { count: resourceCount })}
          </GridCard.Description>
          <GridCard.GoButton onClick={() => navigate(editPath)} />
        </GridCard.Body>
      </GridCard>

      <ConfirmDialog
        open={isConfirmingDelete}
        title={t("resourceLibrary:delete.title")}
        description={t("resourceLibrary:delete.description", { title: resourceLibrary.title })}
        onCancel={() => setIsConfirmingDelete(false)}
        onConfirm={() => {
          dispatch(
            deleteResourceLibrary({
              resourceLibraryId: resourceLibrary.id,
              onSuccess: () => setIsConfirmingDelete(false),
            }),
          )
        }}
      />
    </>
  )
}
