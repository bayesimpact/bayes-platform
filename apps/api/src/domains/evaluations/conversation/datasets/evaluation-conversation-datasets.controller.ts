import {
  type EvaluationConversationDatasetDto,
  EvaluationConversationDatasetsRoutes,
} from "@bayes-platform/api-contracts"
import { Controller, Get, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { EVALUATION_CONVERSATION_DATASET_READ_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import type { EvaluationConversationDataset } from "./evaluation-conversation-dataset.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationDatasetsService } from "./evaluation-conversation-datasets.service"

/**
 * The list of the project's datasets, which the Studio reads to save a conversation as a test
 * case. Evaluation serves every dataset route of its own under `eval/`.
 */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project")
@Controller()
export class EvaluationConversationDatasetsController {
  constructor(
    private readonly evaluationConversationDatasetsService: EvaluationConversationDatasetsService,
  ) {}

  @Get(EvaluationConversationDatasetsRoutes.getAll.path)
  @CheckPermission(EVALUATION_CONVERSATION_DATASET_READ_PERMISSION, "project")
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof EvaluationConversationDatasetsRoutes.getAll.response> {
    const connectScope = getRequiredConnectScope(request)
    const datasets = await this.evaluationConversationDatasetsService.listDatasets({
      connectScope,
    })
    const recordCountByDatasetId =
      await this.evaluationConversationDatasetsService.countRecordsByDatasetId({ connectScope })
    const results: EvaluationConversationDatasetDto[] = datasets.map((dataset) =>
      toEvaluationConversationDatasetDto({
        entity: dataset,
        recordCount: recordCountByDatasetId[dataset.id] ?? 0,
      }),
    )
    return { data: results }
  }
}

function toEvaluationConversationDatasetDto({
  entity,
  recordCount,
}: {
  entity: EvaluationConversationDataset
  recordCount: number
}): EvaluationConversationDatasetDto {
  return {
    createdAt: entity.createdAt.getTime(),
    id: entity.id,
    name: entity.name,
    projectId: entity.projectId,
    recordCount,
    updatedAt: entity.updatedAt.getTime(),
  }
}
