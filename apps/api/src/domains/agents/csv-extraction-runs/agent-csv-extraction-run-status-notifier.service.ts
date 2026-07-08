import type {
  AgentCsvExtractionRunStatusDto,
  AgentCsvExtractionRunSummaryDto,
} from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import type { DataSource } from "typeorm"
import { PostgresStatusNotifierService } from "@/common/sse/postgres-status-notifier.service"
import { AGENT_CSV_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL } from "./agent-csv-extraction-run.constants"

@Injectable()
export class AgentCsvExtractionRunStatusNotifierService extends PostgresStatusNotifierService {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, AGENT_CSV_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL)
  }

  async notifyRunStatusChanged(params: {
    agentCsvExtractionRunId: string
    organizationId: string
    projectId: string
    agentSettingsId: string
    status: AgentCsvExtractionRunStatusDto
    summary: AgentCsvExtractionRunSummaryDto | null
    updatedAt: number
  }): Promise<void> {
    await this.notify({
      type: AGENT_CSV_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL,
      agentCsvExtractionRunId: params.agentCsvExtractionRunId,
      organizationId: params.organizationId,
      projectId: params.projectId,
      agentSettingsId: params.agentSettingsId,
      status: params.status,
      summary: params.summary,
      updatedAt: params.updatedAt,
    })
  }
}
