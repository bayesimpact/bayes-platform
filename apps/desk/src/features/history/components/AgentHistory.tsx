import { Trans } from "@lingui/react/macro"
import type { HistoryAgent } from "../history-entries"
import { useConversationEntries, useExtractionEntries } from "../hooks/use-history-entries"
import { HistoryList } from "./HistoryList"

export type AgentHistoryProps = {
  agent: HistoryAgent
}

/** The sidebar's history: conversations of a conversation agent, extractions of the other kind. */
export function AgentHistory({ agent }: AgentHistoryProps) {
  return agent.type === "conversation" ? (
    <ConversationHistory agent={agent} />
  ) : (
    <ExtractionHistory agent={agent} />
  )
}

function ConversationHistory({ agent }: AgentHistoryProps) {
  const entries = useConversationEntries(agent)
  return <HistoryList agent={agent} entries={entries} empty={<Trans>No conversations yet</Trans>} />
}

function ExtractionHistory({ agent }: AgentHistoryProps) {
  const entries = useExtractionEntries(agent)
  return <HistoryList agent={agent} entries={entries} empty={<Trans>No extractions yet</Trans>} />
}
