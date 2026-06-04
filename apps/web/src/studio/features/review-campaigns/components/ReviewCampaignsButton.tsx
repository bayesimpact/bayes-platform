import { Item } from "@caseai-connect/ui/shad/item"
import { MegaphoneIcon, UsersIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridCard } from "@/common/components/grid/Grid"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { StudioRoutes } from "@/studio/routes/helpers"

export function ReviewCampaignsButton() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const organizationId = useAppSelector(selectCurrentOrganizationId)
  const projectId = useAppSelector(selectCurrentProjectId)
  if (!organizationId || !projectId) return null
  const path = StudioRoutes.reviewCampaigns.build({ organizationId, projectId })
  const handleClick = () => {
    navigate(path)
  }
  return (
    <GridCard className="bg-white">
      <GridCard.Body>
        <GridCard.Title>{t("reviewCampaigns:dashboardCard.title")}</GridCard.Title>
        <GridCard.Description>
          {t("reviewCampaigns:dashboardCard.description")}
        </GridCard.Description>
        <GridCard.GoButton onClick={handleClick} />
      </GridCard.Body>
      <GridCard.Footer>
        <div className="mt-4 flex items-center flex-col max-h-20 overflow-hidden bg-white max-w-full">
          <Item
            variant="outline"
            className="border-b-0 rounded-b-none flex-col w-full flex-1 gap-0"
          >
            <div className="flex items-center gap-2 py-2 px-1 flex-1 w-full">
              <MegaphoneIcon className="size-3.5 text-primary shrink-0" />
              <div className="w-3/5 shrink h-2.5 bg-muted rounded" />
            </div>
            <div className="flex items-center gap-2 py-2 px-1 flex-1 w-full">
              <UsersIcon className="size-3.5 text-primary shrink-0" />
              <div className="w-2/3 shrink h-2.5 bg-muted rounded" />
            </div>
          </Item>
        </div>
      </GridCard.Footer>
    </GridCard>
  )
}
