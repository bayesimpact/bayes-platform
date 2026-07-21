import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { EvalRoutes } from "../routes/helpers"

export function useEvaluationConversationDatasetPath() {
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)

  const buildEvaluationConversationDatasetPath = ({ datasetId }: { datasetId: string }): string => {
    return EvalRoutes.conversationDataset.build({ organizationId, projectId, datasetId })
  }
  return { buildEvaluationConversationDatasetPath }
}
