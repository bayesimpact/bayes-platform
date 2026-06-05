import { Item } from "@caseai-connect/ui/shad/item"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridCard } from "@/common/components/grid/Grid"
import { RestrictedFeature } from "@/common/components/RestrictedFeature"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { StudioRoutes } from "@/studio/routes/helpers"

const bars = [40, 65, 45, 80, 55, 70, 90, 60, 75, 50, 85, 68]
export function AnalyticsButton() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const organizationId = useAppSelector(selectCurrentOrganizationId)
  const projectId = useAppSelector(selectCurrentProjectId)
  if (!organizationId || !projectId) return null
  const path = StudioRoutes.projectAnalytics.build({ organizationId, projectId })
  const handleClick = () => {
    navigate(path)
  }
  return (
    <RestrictedFeature feature="project-analytics">
      <GridCard className="bg-white">
        <GridCard.Body>
          <GridCard.Title>{t("analytics:list.title")}</GridCard.Title>
          <GridCard.Description>{t("analytics:list.description")}</GridCard.Description>
          <GridCard.GoButton onClick={handleClick} />
        </GridCard.Body>
        <GridCard.Footer>
          <div className="mt-4 flex items-center gap-2 flex-col max-h-20 overflow-hidden">
            <Item variant="outline" className="border-b-0 rounded-b-none w-full">
              <div className="flex items-end gap-1 h-12 w-full">
                {bars.map((height, barIndex) => (
                  <div
                    key={`bar-${barIndex}-${height}`}
                    className="flex-1 rounded-sm bg-primary"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </Item>
          </div>
        </GridCard.Footer>
      </GridCard>
    </RestrictedFeature>
  )
}
