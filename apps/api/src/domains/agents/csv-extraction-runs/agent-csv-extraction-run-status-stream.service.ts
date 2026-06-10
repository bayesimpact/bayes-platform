import type { AgentCsvExtractionRunStatusChangedEventDto } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { PostgresStatusStreamService } from "@/common/sse/postgres-status-stream.service"
import { AGENT_CSV_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL } from "./agent-csv-extraction-run.constants"

@Injectable()
export class AgentCsvExtractionRunStatusStreamService extends PostgresStatusStreamService<AgentCsvExtractionRunStatusChangedEventDto> {
  constructor() {
    super({
      channel: AGENT_CSV_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL,
      expectedType: AGENT_CSV_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL,
      serviceName: AgentCsvExtractionRunStatusStreamService.name,
      isExpectedEvent: (payload) =>
        payload.type === AGENT_CSV_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL,
    })
  }
}
