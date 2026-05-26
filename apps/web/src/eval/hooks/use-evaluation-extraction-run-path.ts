import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { selectCurrentDatasetId } from "../features/evaluation-extraction-datasets/evaluation-extraction-datasets.selectors"
import { EvalRoutes } from "../routes/helpers"

export function useEvaluationExtractionRunPath() {
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const datasetId = useCurrentId(selectCurrentDatasetId)

  const buildRunPath = ({ runId }: { runId: string }): string => {
    return EvalRoutes.evaluationRun.build({ organizationId, projectId, datasetId, runId })
  }
  return { buildRunPath }
}
