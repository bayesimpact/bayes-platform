import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { EvaluationConversationDataset } from "@/domains/evaluations/conversation/datasets/evaluation-conversation-dataset.entity"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type {
  EndpointRequestWithEvaluationConversationDataset,
  EndpointRequestWithProject,
} from "../request.interface"

@Injectable()
export class EvaluationConversationDatasetContextResolver implements ContextResolver {
  readonly resource = "evaluationConversationDataset" as const

  constructor(
    @InjectRepository(EvaluationConversationDataset)
    private readonly evaluationConversationDatasetRepository: Repository<EvaluationConversationDataset>,
  ) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithParams = request as ResolvableRequest & {
      params: { datasetId?: string }
    }
    const evaluationConversationDatasetId = requestWithParams.params?.datasetId

    if (!evaluationConversationDatasetId || evaluationConversationDatasetId === ":datasetId")
      throw new NotFoundException()

    const requestWithProject = request as EndpointRequestWithProject
    const evaluationConversationDataset =
      (await this.evaluationConversationDatasetRepository.findOne({
        where: {
          id: evaluationConversationDatasetId,
          organizationId: requestWithProject.organizationId,
          projectId: requestWithProject.project.id,
        },
      })) ?? undefined
    if (!evaluationConversationDataset) throw new NotFoundException()

    const requestWithEvaluationConversationDataset =
      request as EndpointRequestWithEvaluationConversationDataset
    requestWithEvaluationConversationDataset.evaluationConversationDataset =
      evaluationConversationDataset
  }
}
