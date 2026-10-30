import type { AgentParamsDto } from "@caseai-connect/desk-contracts"
import { linkOptions } from "@tanstack/react-router"
import { agentParamsOf } from "@/lib/agent-params"
import type { HistoryEntry } from "./history-entries"

/** Where an entry of the history opens, for a link or a navigation: its conversation or its run. */
export function entryLinkOptions(agent: AgentParamsDto, entry: HistoryEntry) {
  const params = agentParamsOf(agent)
  switch (entry.kind) {
    case "conversation":
      return linkOptions({
        to: "/o/$organizationId/p/$projectId/a/$agentId/as/$agentSessionId",
        params: { ...params, agentSessionId: entry.id },
      })
    case "extraction":
      return linkOptions({
        to: "/o/$organizationId/p/$projectId/a/$agentId/extraction/runs/$extractionRunId",
        params: { ...params, extractionRunId: entry.id },
      })
    case "csv":
      return linkOptions({
        to: "/o/$organizationId/p/$projectId/a/$agentId/extraction/csv-runs/$csvRunId",
        params: { ...params, csvRunId: entry.id },
      })
    default:
      return entry satisfies never
  }
}
