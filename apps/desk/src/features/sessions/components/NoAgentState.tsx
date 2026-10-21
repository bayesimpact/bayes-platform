import { Trans } from "@lingui/react/macro"
import { BotIcon } from "lucide-react"
import { StatusPage } from "@/components/shared/StatusPage"

/** The Desk of a person who has no agent to use yet. */
export function NoAgentState() {
  return (
    <StatusPage
      icon={<BotIcon aria-hidden />}
      title={<Trans>You don't have access to an agent yet</Trans>}
      description={<Trans>When someone gives you access to an agent, it appears here.</Trans>}
    />
  )
}
