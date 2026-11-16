import { Item } from "@caseai-connect/ui/shad/item"
import { cn } from "@caseai-connect/ui/utils"
import { UserIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridCard } from "@/common/components/grid/Grid"
import { StudioRoutes } from "@/studio/routes/helpers"

/** Card of the agent page that opens the agent's members, next to the analytics and feedback ones. */
export function AgentMembersCard({
  agentId,
  organizationId,
  projectId,
  withBorderBottom,
  className,
}: {
  agentId: string
  organizationId: string
  projectId: string
  withBorderBottom?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const handleClick = () => {
    navigate(StudioRoutes.agentMemberships.build({ organizationId, projectId, agentId }))
  }
  return (
    <GridCard className={cn("bg-white", withBorderBottom && "border-b", className)}>
      <GridCard.Body>
        <GridCard.Title>{t("agentMembership:members")}</GridCard.Title>
        <GridCard.Description>{t("agentMembership:list.description")}</GridCard.Description>
        <GridCard.GoButton onClick={handleClick} />
      </GridCard.Body>
      <GridCard.Footer>
        <div className="mt-4 flex max-h-20 max-w-full flex-col items-center overflow-hidden bg-white">
          <Item
            variant="outline"
            className="w-full flex-1 flex-col gap-0 rounded-b-none border-b-0"
          >
            {["w-2/3", "w-1/2"].map((width) => (
              <div key={width} className="flex w-full flex-1 items-center gap-2 px-1 py-2">
                <UserIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <div className={cn("h-2.5 shrink rounded bg-muted", width)} />
              </div>
            ))}
          </Item>
        </div>
      </GridCard.Footer>
    </GridCard>
  )
}
