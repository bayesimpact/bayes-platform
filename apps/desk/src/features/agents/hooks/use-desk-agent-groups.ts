import { useSuspenseQuery } from "@tanstack/react-query"
import { deskAgentsQueryOptions } from "../api/queries"
import type { DeskProjectAgents } from "../desk-agents"

/** The agents of every Desk project, from the query `loadDeskAgents` started. */
export function useDeskAgentGroups(): DeskProjectAgents[] {
  return useSuspenseQuery(deskAgentsQueryOptions()).data
}
