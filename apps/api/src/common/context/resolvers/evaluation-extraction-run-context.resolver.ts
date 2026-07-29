import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { EvaluationExtractionRun } from "@/domains/evaluations/extraction/runs/evaluation-extraction-run.entity"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type {
  EndpointRequestWithEvaluationExtractionRun,
  EndpointRequestWithProject,
} from "../request.interface"

@Injectable()
export class EvaluationExtractionRunContextResolver implements ContextResolver {
  readonly resource = "evaluationExtractionRun" as const

  constructor(
    @InjectRepository(EvaluationExtractionRun)
    private readonly evaluationExtractionRunRepository: Repository<EvaluationExtractionRun>,
  ) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithParams = request as ResolvableRequest & {
      params: { evaluationExtractionRunId?: string }
    }
    const evaluationExtractionRunId = requestWithParams.params?.evaluationExtractionRunId

    if (!evaluationExtractionRunId || evaluationExtractionRunId === ":evaluationExtractionRunId")
      throw new NotFoundException()

    const requestWithProject = request as EndpointRequestWithProject
    const evaluationExtractionRun =
      (await this.evaluationExtractionRunRepository.findOne({
        where: {
          id: evaluationExtractionRunId,
          organizationId: requestWithProject.organizationId,
          projectId: requestWithProject.project.id,
        },
        // Controllers expose the pinned agent-settings snapshot on every run response.
        relations: { agentSettings: true },
      })) ?? undefined
    if (!evaluationExtractionRun) throw new NotFoundException()

    const requestWithEvaluationExtractionRun = request as EndpointRequestWithEvaluationExtractionRun
    requestWithEvaluationExtractionRun.evaluationExtractionRun = evaluationExtractionRun
  }
}
