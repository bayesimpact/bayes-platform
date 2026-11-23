import type { EvaluationConversationDataset } from "./evaluation-conversation-datasets.models"

export interface IEvaluationConversationDatasetsSpi {
  getAll(params: {
    organizationId: string
    projectId: string
  }): Promise<EvaluationConversationDataset[]>
}
