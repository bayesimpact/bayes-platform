import { Button } from "@bayes-platform/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@bayes-platform/ui/shad/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bayes-platform/ui/shad/dropdown-menu"
import { EllipsisIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import type { Project } from "@/common/features/projects/projects.models"
import { RouteNames } from "@/common/routes/helpers"
import { useAppDispatch } from "@/common/store/hooks"
import { deleteProject } from "@/studio/features/projects/projects.thunks"

/**
 * The "More" menu of the project page: it holds Delete, kept out of the header's first row,
 * and the dialog that confirms it.
 */
export function ProjectDeletor({ project }: { project: Project }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const [open, setOpen] = useState<boolean>(false)

  const onSuccess = () => {
    navigate(RouteNames.ONBOARDING, { replace: true })
    setOpen(false)
  }

  const handleDelete = () => dispatch(deleteProject({ onSuccess }))

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={t("actions:more")}>
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => setOpen(true)}>
            <Trash2Icon />
            {t("actions:delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("project:delete.title")}</DialogTitle>
            <DialogDescription>
              {t("project:delete.description", { name: project.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("actions:cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t("actions:confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
