import type { CampaignContextOutputDto } from "@caseai-connect/eval-contracts"
import { BotIcon } from "lucide-react"
import type { ReactNode } from "react"

export type CampaignAgentCardProps = {
  agent: CampaignContextOutputDto["agent"]
  /** What sits at the end of the card, such as the button that starts a session. */
  action?: ReactNode
}

/** The agent a campaign reviews: its name and what it says first. */
export function CampaignAgentCard({ agent, action }: CampaignAgentCardProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-background p-4 dark:bg-card">
      <BotIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-medium">{agent.name}</span>
        {agent.greetingMessage ? (
          <span className="line-clamp-2 text-sm text-muted-foreground italic">
            “{agent.greetingMessage}”
          </span>
        ) : null}
      </div>
      {action}
    </div>
  )
}
