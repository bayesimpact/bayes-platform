import { Item } from "@caseai-connect/ui/shad/item"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridItem } from "@/common/components/grid/Grid"
import { RestrictedFeature } from "@/common/components/RestrictedFeature"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { StudioRoutes } from "@/studio/routes/helpers"

const bars = [40, 65, 45, 80, 55, 70, 90, 60, 75, 50, 85, 68]
export function AnalyticsButton({ index }: { index: number }) {
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
      <GridItem
        index={index}
        title={t("analytics:list.title")}
        description={t("analytics:list.description")}
        onClick={handleClick}
        className="bg-white"
        footer={
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
        }
      />
    </RestrictedFeature>
  )
}
