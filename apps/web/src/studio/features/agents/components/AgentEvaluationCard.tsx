import { Button } from "@caseai-connect/ui/shad/button"
import { Item } from "@caseai-connect/ui/shad/item"
import { cn } from "@caseai-connect/ui/utils"
import { CircleCheckIcon, ExternalLinkIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { GridCard } from "@/common/components/grid/Grid"
import type { Agent } from "@/common/features/agents/agents.models"
import { EvalRoutes } from "@/eval/routes/helpers"

/**
 * Card of the agent page that opens the evaluation app in another tab, on the evaluations of
 * the agent's type. Its caller shows it to the people who can open that app.
 */
export function AgentEvaluationCard({
  agentType,
  organizationId,
  projectId,
  withBorderBottom,
  className,
}: {
  agentType: Agent["type"]
  organizationId: string
  projectId: string
  withBorderBottom?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const route = agentType === "extraction" ? EvalRoutes.extraction : EvalRoutes.conversation
  const path = route.build({ organizationId, projectId })
  return (
    <GridCard className={cn("bg-white", withBorderBottom && "border-b", className)}>
      <GridCard.Body>
        <GridCard.Title>{t("actions:goToEval")}</GridCard.Title>
        <GridCard.Description>{t("agent:evaluationCard.description")}</GridCard.Description>
        {/* An external link, not the card's arrow: the evaluation app opens in another tab. */}
        <Button asChild size="icon" variant="outline" className="rounded-full">
          <a
            href={path}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("agent:evaluationCard.open")}
          >
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
                <CircleCheckIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <div className={cn("h-2.5 shrink rounded bg-muted", width)} />
              </div>
            ))}
          </Item>
        </div>
      </GridCard.Footer>
    </GridCard>
  )
}
