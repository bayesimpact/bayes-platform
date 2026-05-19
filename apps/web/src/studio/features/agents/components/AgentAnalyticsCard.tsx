import { Item } from "@caseai-connect/ui/shad/item"
import { cn } from "@caseai-connect/ui/utils"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridItem } from "@/common/components/grid/Grid"
import { StudioRoutes } from "@/studio/routes/helpers"

const bars = [40, 65, 45, 80, 55, 70, 90, 60, 75, 50, 85, 68]

export function AgentAnalyticsCard({
  agentId,
  organizationId,
  projectId,
  index,
  withBorderBottom,
  className,
}: {
  agentId: string
  organizationId: string
  projectId: string
  index: number
  withBorderBottom?: boolean
  className?: string
}) {
  const { t } = useTranslation("agentAnalytics")
  const navigate = useNavigate()
  const path = StudioRoutes.agentAnalytics.build({ organizationId, projectId, agentId })
  const handleClick = () => {
    navigate(path)
  }
  return (
    <GridItem
      className={cn("bg-white", withBorderBottom && "border-b", className)}
      index={index}
      title={t("list.title")}
      description={t("list.description")}
      onClick={handleClick}
      footer={
        <div className="mt-4 flex items-center gap-2 flex-col max-h-20 overflow-hidden">
          <Item variant="outline" className="border-b-0 rounded-b-none w-full">
            <div className="flex items-end gap-1 h-12 w-full">
              {bars.map((height, barIndex) => (
                <div
                  key={`agent-analytics-bar-${barIndex}-${height}`}
                  className="flex-1 rounded-sm bg-primary"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </Item>
        </div>
      }
    />
  )
}
