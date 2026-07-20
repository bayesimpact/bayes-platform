import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { EvaluationConversationRun } from "@/domains/evaluations/conversation/runs/evaluation-conversation-run.entity"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type {
  EndpointRequestWithEvaluationConversationRun,
  EndpointRequestWithProject,
} from "../request.interface"

@Injectable()
export class EvaluationConversationRunContextResolver implements ContextResolver {
  readonly resource = "evaluationConversationRun" as const

  constructor(
    @InjectRepository(EvaluationConversationRun)
    private readonly evaluationConversationRunRepository: Repository<EvaluationConversationRun>,
  ) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithParams = request as ResolvableRequest & {
      params: { evaluationConversationRunId?: string }
    }
    const evaluationConversationRunId = requestWithParams.params?.evaluationConversationRunId

    if (
      !evaluationConversationRunId ||
      evaluationConversationRunId === ":evaluationConversationRunId"
    )
      throw new NotFoundException()

    const requestWithProject = request as EndpointRequestWithProject
    const evaluationConversationRun =
      (await this.evaluationConversationRunRepository.findOne({
        where: {
          id: evaluationConversationRunId,
          organizationId: requestWithProject.organizationId,
          projectId: requestWithProject.project.id,
        },
      })) ?? undefined
    if (!evaluationConversationRun) throw new NotFoundException()

    const requestWithEvaluationConversationRun =
      request as EndpointRequestWithEvaluationConversationRun
    requestWithEvaluationConversationRun.evaluationConversationRun = evaluationConversationRun
  }
}
