import type {
  EvaluationExtractionRunStatusDto,
  EvaluationExtractionRunSummaryDto,
} from "@bayes-platform/api-contracts"
import { Injectable } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import type { DataSource } from "typeorm"
import { PostgresStatusNotifierService } from "@/common/sse/postgres-status-notifier.service"
import { EVALUATION_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL } from "./evaluation-extraction-run.constants"

@Injectable()
export class EvaluationExtractionRunStatusNotifierService extends PostgresStatusNotifierService {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, EVALUATION_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL)
  }

  async notifyRunStatusChanged(params: {
    evaluationExtractionRunId: string
    organizationId: string
    projectId: string
    status: EvaluationExtractionRunStatusDto
    summary: EvaluationExtractionRunSummaryDto | null
    updatedAt: number
  }): Promise<void> {
    await this.notify({
      type: EVALUATION_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL,
      evaluationExtractionRunId: params.evaluationExtractionRunId,
      organizationId: params.organizationId,
      projectId: params.projectId,
      status: params.status,
      summary: params.summary,
      updatedAt: params.updatedAt,
    })
  }
}
