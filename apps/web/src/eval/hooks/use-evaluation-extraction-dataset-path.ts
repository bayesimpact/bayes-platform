import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { assert } from "@/common/utils/assert"
import { EvalRoutes } from "../routes/helpers"

export function useEvaluationExtractionDatasetPath() {
  const organizationId = useAppSelector(selectCurrentOrganizationId)
  const projectId = useAppSelector(selectCurrentProjectId)

  const buildEvaluationExtractionDatasetPath = ({ datasetId }: { datasetId: string }): string => {
    assert(organizationId, "Organization ID is required to build dataset path")
    assert(projectId, "Project ID is required to build dataset path")

    return EvalRoutes.extractionDataset.build({ organizationId, projectId, datasetId })
  }

  return { buildEvaluationExtractionDatasetPath }
}
