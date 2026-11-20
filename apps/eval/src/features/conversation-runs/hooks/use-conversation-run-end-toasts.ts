import type { ProjectParamsDto } from "@caseai-connect/eval-contracts"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useRunEndToasts } from "@/hooks/use-run-end-toasts"
import { projectConversationRunsQueryOptions } from "../api/queries"

/**
 * Tells the person when a conversation run of the project ends, on a page that lists them: the list
 * is read again by itself while a run is under way.
 */
export function useConversationRunEndToasts(project: ProjectParamsDto): void {
  const { data: runs } = useSuspenseQuery(projectConversationRunsQueryOptions(project))
  useRunEndToasts(runs)
}
