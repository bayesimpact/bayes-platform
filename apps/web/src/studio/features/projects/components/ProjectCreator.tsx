import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import { PlusCircleIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { GridCard } from "@/common/components/grid/Grid"
import type { Organization } from "@/common/features/organizations/organizations.models"
import { useAppDispatch } from "@/common/store/hooks"
import { ProjectForm } from "@/studio/features/projects/components/ProjectForm"
import { createProject } from "@/studio/features/projects/projects.thunks"
import { StudioRoutes } from "@/studio/routes/helpers"

export function ProjectCreatorButton({ organization }: { organization: Organization }) {
  const { t } = useTranslation()
  return (
    <GridCard className="bg-muted/35">
      <GridCard.Body>
        <GridCard.Title>{t("project:create.title")}</GridCard.Title>
        <GridCard.Description>
          {t("project:create.description", { organizationName: organization.name })}
        </GridCard.Description>
        <ProjectCreator organization={organization} />
      </GridCard.Body>
    </GridCard>
  )
}

export function ProjectCreator({
  organization,
  modalHandler,
}: {
  organization: Organization
  modalHandler?: {
    open: boolean
    setOpen: (open: boolean) => void
  }
}) {
  const { t } = useTranslation()

  const [open, setOpen] = useState(false)

  const handleSuccess = (projectId: string) => {
    modalHandler ? modalHandler.setOpen(false) : setOpen(false)

    const path = StudioRoutes.project.build({
      organizationId: organization.id,
      projectId,
    })
    // NOTE: do not use navigate from react-router
    window.location.assign(path)
  }

  return (
    <Dialog
      open={modalHandler ? modalHandler.open : open}
      onOpenChange={modalHandler ? modalHandler.setOpen : setOpen}
    >
      {!modalHandler && (
        <DialogTrigger asChild>
          <Button size="lg" className="text-base">
            {t("actions:create")}
            <PlusCircleIcon className="ml-2 size-5" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("project:create.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("project:create.dialog.description", { organizationName: organization.name })}
          </DialogDescription>
        </DialogHeader>

        <CreateForm onSuccess={handleSuccess} organizationId={organization.id} />
      </DialogContent>
    </Dialog>
  )
}

function CreateForm({
  onSuccess,
  organizationId,
}: {
  onSuccess: (projectId: string) => void
  organizationId: string
}) {
  const dispatch = useAppDispatch()
  const handleSubmit = async (data: { name: string }) => {
    dispatch(createProject({ organizationId, payload: { name: data.name }, onSuccess }))
  }
  return <ProjectForm onSubmit={handleSubmit} />
}
