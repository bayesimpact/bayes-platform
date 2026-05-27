import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { EvalRoutes } from "../routes/helpers"

export function useEvaluationExtractionDatasetPath() {
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)

  const buildEvaluationExtractionDatasetPath = ({ datasetId }: { datasetId: string }): string => {
    return EvalRoutes.extractionDataset.build({ organizationId, projectId, datasetId })
  }
  return { buildEvaluationExtractionDatasetPath }
}
