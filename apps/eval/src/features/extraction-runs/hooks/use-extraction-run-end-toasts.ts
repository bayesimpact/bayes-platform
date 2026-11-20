import type { ProjectParamsDto } from "@caseai-connect/eval-contracts"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useRunEndToasts } from "@/hooks/use-run-end-toasts"
import { projectExtractionRunsQueryOptions } from "../api/queries"

/**
 * Tells the person when a extraction run of the project ends, on a page that lists them: the list
 * is read again by itself while a run is under way.
 */
export function useExtractionRunEndToasts(project: ProjectParamsDto): void {
  const { data: runs } = useSuspenseQuery(projectExtractionRunsQueryOptions(project))
  useRunEndToasts(runs)
}
