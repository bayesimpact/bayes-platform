import type { ExtractionAgentSessionStatus } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import type { DataSource } from "typeorm"
import { PostgresStatusNotifierService } from "@/common/sse/postgres-status-notifier.service"
import { EXTRACTION_AGENT_SESSION_STATUS_CHANGED_CHANNEL } from "./extraction-agent-session.constants"

@Injectable()
export class ExtractionAgentSessionStatusNotifierService extends PostgresStatusNotifierService {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, EXTRACTION_AGENT_SESSION_STATUS_CHANGED_CHANNEL)
  }

  async notifySessionStatusChanged(params: {
    extractionAgentSessionId: string
    organizationId: string
    projectId: string
    agentId: string
    status: ExtractionAgentSessionStatus
    updatedAt: number
  }): Promise<void> {
    await this.notify({
      type: EXTRACTION_AGENT_SESSION_STATUS_CHANGED_CHANNEL,
      extractionAgentSessionId: params.extractionAgentSessionId,
      organizationId: params.organizationId,
      projectId: params.projectId,
      agentId: params.agentId,
      status: params.status,
      updatedAt: params.updatedAt,
    })
  }
}
