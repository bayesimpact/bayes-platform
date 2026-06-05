import { Item } from "@caseai-connect/ui/shad/item"
import { SendIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridCard } from "@/common/components/grid/Grid"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { StudioRoutes } from "@/studio/routes/helpers"

export function MembersButton() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const organizationId = useAppSelector(selectCurrentOrganizationId)
  const projectId = useAppSelector(selectCurrentProjectId)
  if (!organizationId || !projectId) return null
  const path = StudioRoutes.projectMemberships.build({ organizationId, projectId })
  const handleClick = () => {
    navigate(path)
  }
  return (
    <GridCard className="bg-white">
      <GridCard.Body>
        <GridCard.Title>{t("projectMembership:members")}</GridCard.Title>
        <GridCard.Description>{t("projectMembership:list.empty.description")}</GridCard.Description>
        <GridCard.GoButton onClick={handleClick} />
      </GridCard.Body>
      <GridCard.Footer>
        <div className="mt-4 max-h-20 overflow-hidden flex items-center gap-2 flex-col bg-white max-w-full">
          <Item variant="outline" className="border-b-0 rounded-b-none flex-col w-full flex-1">
            <div className="flex flex-1 w-full items-center gap-2">
              <Item variant="outline" className="p-1 flex-col w-full flex-1 gap-0">
                <div className="text-sm flex-1 text-muted-foreground/50 flex items-center gap-1 w-full">
                  <div className="w-1/3 shrink h-2.5 bg-muted rounded" />@
                  <div className="w-2/3 shrink h-2.5 bg-muted rounded" />•
                  <div className="w-6 shrink h-2.5 bg-muted rounded" />
                </div>
              </Item>
              <div className="bg-primary shrink-0 text-white rounded p-2 text-xs flex items-center gap-1">
                <SendIcon className="size-3" />
              </div>
            </div>

            <div className="flex flex-1 w-full items-center gap-2">
              <Item variant="outline" className="p-1 flex-col w-full flex-1 gap-0">
                <div className="text-sm flex-1 text-muted-foreground/50 flex items-center gap-1 w-full">
                  <div className="w-2/3 shrink h-2.5 bg-muted rounded" />@
                  <div className="w-1/2 shrink h-2.5 bg-muted rounded" />•
                  <div className="w-6 shrink h-2.5 bg-muted rounded" />
                </div>
              </Item>
              <div className="bg-muted-foreground shrink-0 text-white rounded p-2 text-xs flex items-center gap-1">
                <Trash2Icon className="size-3" />
              </div>
            </div>
          </Item>
        </div>
      </GridCard.Footer>
    </GridCard>
  )
}
