import type { CampaignContextOutputDto } from "@bayes-platform/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import type { ReactNode } from "react"
import { AgentTypeIcon } from "@/components/shared/AgentTypeIcon"
import { AGENT_TYPE_LABELS } from "@/lib/agent-type-labels"

export type CampaignAgentCardProps = {
  agent: CampaignContextOutputDto["agent"]
  /** What sits at the end of the card, such as the button that starts a session. */
  action?: ReactNode
}

/** The agent a campaign reviews: its kind, its name and what it says first. */
export function CampaignAgentCard({ agent, action }: CampaignAgentCardProps) {
  const { i18n } = useLingui()
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-background p-4 dark:bg-card">
      <span className="flex shrink-0 text-muted-foreground [&_svg]:size-5">
        <AgentTypeIcon type={agent.type} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">
          {i18n._(AGENT_TYPE_LABELS[agent.type])}
        </span>
        <span className="font-medium">{agent.name}</span>
        {agent.greetingMessage ? (
          <span className="line-clamp-2 text-sm text-muted-foreground">
            <span className="font-medium">
              <Trans comment="Before the first message an agent says in a new session">
                Greeting message:
              </Trans>
            </span>{" "}
            <span className="italic">“{agent.greetingMessage}”</span>
          </span>
        ) : null}
      </div>
      {action}
    </div>
  )
}
