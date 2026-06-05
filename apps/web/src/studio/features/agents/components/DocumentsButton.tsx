import { Item } from "@caseai-connect/ui/shad/item"
import { CloudAlertIcon, FileImage, FileTextIcon, Loader2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridCard } from "@/common/components/grid/Grid"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { StudioRoutes } from "@/studio/routes/helpers"
import { selectUploaderState } from "../../documents/documents.selectors"

export function DocumentsButton() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const organizationId = useAppSelector(selectCurrentOrganizationId)
  const projectId = useAppSelector(selectCurrentProjectId)
  if (!organizationId || !projectId) return null
  const path = StudioRoutes.documents.build({ organizationId, projectId })
  const handleClick = () => {
    navigate(path)
  }
  return (
    <GridCard className="bg-white">
      <GridCard.Body>
        <GridCard.Title>
          <div className="inline-flex">
            {t("document:documents")} <UploaderState />
          </div>
        </GridCard.Title>
        <GridCard.Description>{t("document:list.description")}</GridCard.Description>
        <GridCard.GoButton onClick={handleClick} />
      </GridCard.Body>
      <GridCard.Footer>
        <div className="mt-4 flex items-center flex-col max-h-20 overflow-hidden max-w-full bg-white">
          <Item
            variant="outline"
            className="border-b-0 rounded-b-none flex-col w-full flex-1 gap-0"
          >
            <div className="flex flex-1 items-center gap-2 py-2 px-1 w-full">
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
              <div className="w-1/3 h-2.5 bg-muted rounded shrink" />
              <div className="w-3/4 h-2.5 bg-muted rounded shrink" />
            </div>
            <div className="flex flex-1 items-center gap-2 py-2 px-1 w-full">
              <FileImage className="size-4 shrink-0 text-muted-foreground" />
              <div className="w-2/3 h-2.5 bg-muted rounded shrink" />
              <div className="w-4/5 h-2.5 bg-muted rounded shrink" />
            </div>
          </Item>
        </div>
      </GridCard.Footer>
    </GridCard>
  )
}

function UploaderState() {
  const uploaderState = useAppSelector(selectUploaderState)
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm">
      {uploaderState.status === "uploading" && (
        <>
          <Loader2Icon className="animate-spin size-4" />
          <span className="text-xs text-muted-foreground">
            {uploaderState.processed}/{uploaderState.total}
          </span>
        </>
      )}

      {uploaderState.errors && uploaderState.errors.length > 0 && (
        <CloudAlertIcon className="text-destructive size-5 animate-pulse" />
      )}
    </div>
  )
}
