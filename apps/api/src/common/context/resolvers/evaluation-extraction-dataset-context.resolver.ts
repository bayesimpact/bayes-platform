import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { EvaluationExtractionDataset } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-dataset.entity"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type {
  EndpointRequestWithEvaluationExtractionDataset,
  EndpointRequestWithProject,
} from "../request.interface"

@Injectable()
export class EvaluationExtractionDatasetContextResolver implements ContextResolver {
  readonly resource = "evaluationExtractionDataset" as const

  constructor(
    @InjectRepository(EvaluationExtractionDataset)
    private readonly evaluationExtractionDatasetRepository: Repository<EvaluationExtractionDataset>,
  ) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithParams = request as ResolvableRequest & {
      params: { datasetId?: string }
    }
    const evaluationExtractionDatasetId = requestWithParams.params?.datasetId

    if (!evaluationExtractionDatasetId || evaluationExtractionDatasetId === ":datasetId")
      throw new NotFoundException()

    const requestWithProject = request as EndpointRequestWithProject
    const evaluationExtractionDataset =
      (await this.evaluationExtractionDatasetRepository.findOne({
        where: {
          id: evaluationExtractionDatasetId,
          organizationId: requestWithProject.organizationId,
          projectId: requestWithProject.project.id,
        },
      })) ?? undefined
    if (!evaluationExtractionDataset) throw new NotFoundException()

    const requestWithEvaluationExtractionDataset =
      request as EndpointRequestWithEvaluationExtractionDataset
    requestWithEvaluationExtractionDataset.evaluationExtractionDataset = evaluationExtractionDataset
  }
}
