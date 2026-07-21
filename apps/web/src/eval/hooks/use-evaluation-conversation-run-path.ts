import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { selectCurrentConversationDatasetId } from "../features/evaluation-conversation-datasets/evaluation-conversation-datasets.selectors"
import { EvalRoutes } from "../routes/helpers"

export function useEvaluationConversationRunPath() {
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const datasetId = useCurrentId(selectCurrentConversationDatasetId)

  const buildConversationRunPath = ({ runId }: { runId: string }): string => {
    return EvalRoutes.conversationRun.build({ organizationId, projectId, datasetId, runId })
  }

  const buildConversationComparePath = ({ runIds }: { runIds: string[] }): string => {
    const path = EvalRoutes.conversationDatasetCompare.build({
      organizationId,
      projectId,
      datasetId,
    })
    const search = new URLSearchParams({ runs: runIds.join(",") }).toString()
    return `${path}?${search}`
  }

  return { buildConversationRunPath, buildConversationComparePath }
}
