import { Button } from "@caseai-connect/ui/shad/button"
import { Item } from "@caseai-connect/ui/shad/item"
import { cn } from "@caseai-connect/ui/utils"
import { CircleCheckIcon, ExternalLinkIcon, type LucideIcon, MessageSquareIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { GridCard } from "@/common/components/grid/Grid"
import type { Agent } from "@/common/features/agents/agents.models"
import { DeskRoutes } from "@/common/routes/desk-routes"
import { EvalRoutes } from "@/eval/routes/helpers"

/**
 * Card of the agent page that opens another app in a new tab. It carries an external link in
 * place of the arrow of the cards that stay in the Studio.
 */
function AgentExternalAppCard({
  title,
  description,
  openLabel,
  href,
  icon: Icon,
  withBorderBottom,
}: {
  title: string
  description: string
  /** Accessible name of the link. */
  openLabel: string
  href: string
  /** Drawn on the placeholder lines at the bottom of the card. */
  icon: LucideIcon
  withBorderBottom?: boolean
}) {
  return (
    <GridCard className={cn("bg-white", withBorderBottom && "border-b")}>
      <GridCard.Body>
        <GridCard.Title>{title}</GridCard.Title>
        <GridCard.Description>{description}</GridCard.Description>
        <Button asChild size="icon" variant="outline" className="rounded-full">
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label={openLabel}>
            <ExternalLinkIcon className="size-4" />
          </a>
        </Button>
      </GridCard.Body>
      <GridCard.Footer>
        <div className="mt-4 flex max-h-20 max-w-full flex-col items-center overflow-hidden bg-white">
          <Item
            variant="outline"
            className="w-full flex-1 flex-col gap-0 rounded-b-none border-b-0"
          >
            {["w-2/3", "w-1/2"].map((width) => (
              <div key={width} className="flex w-full flex-1 items-center gap-2 px-1 py-2">
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <div className={cn("h-2.5 shrink rounded bg-muted", width)} />
              </div>
            ))}
          </Item>
        </div>
      </GridCard.Footer>
    </GridCard>
  )
}

type AgentCardProps = {
  organizationId: string
  projectId: string
  withBorderBottom?: boolean
}

/**
 * Opens the evaluation app on the evaluations of the agent's type. Its caller shows it to the
 * people who can open that app.
 */
export function AgentEvaluationCard({
  agentType,
  organizationId,
  projectId,
  withBorderBottom,
}: AgentCardProps & { agentType: Agent["type"] }) {
  const { t } = useTranslation()
  const route = agentType === "extraction" ? EvalRoutes.extraction : EvalRoutes.conversation
  return (
    <AgentExternalAppCard
      title={t("actions:goToEval")}
      description={t("agent:evaluationCard.description")}
      openLabel={t("agent:evaluationCard.open")}
      href={route.build({ organizationId, projectId })}
      icon={CircleCheckIcon}
      withBorderBottom={withBorderBottom}
    />
  )
}

/**
 * Opens the agent in the app its users see, which runs its published version. Its caller shows
 * it once the agent is published: the app lists no agent that only has a draft.
 */
export function AgentProductionAppCard({
  agentId,
  organizationId,
  projectId,
  withBorderBottom,
}: AgentCardProps & { agentId: string }) {
  const { t } = useTranslation()
  return (
    <AgentExternalAppCard
      title={t("agent:goToProductionApp")}
      description={t("agent:productionAppCard.description")}
      openLabel={t("agent:productionAppCard.open")}
      href={DeskRoutes.agent.build({ organizationId, projectId, agentId })}
      icon={MessageSquareIcon}
      withBorderBottom={withBorderBottom}
    />
  )
}
