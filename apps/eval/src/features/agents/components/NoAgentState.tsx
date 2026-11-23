import { Trans } from "@lingui/react/macro"
import { BotIcon } from "lucide-react"
import { StatusPage } from "@/components/shared/StatusPage"

/** The app of an evaluator whose projects have no agent yet. */
export function NoAgentState() {
  return (
    <StatusPage
      icon={<BotIcon aria-hidden />}
      title={<Trans>Your projects have no agent yet</Trans>}
      description={
        <Trans>When an agent is created in one of your projects, it appears here.</Trans>
      }
    />
  )
}
