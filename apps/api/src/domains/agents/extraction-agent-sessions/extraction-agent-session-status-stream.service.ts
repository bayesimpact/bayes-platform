import type { ExtractionAgentSessionStatusChangedEventDto } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { PostgresStatusStreamService } from "@/common/sse/postgres-status-stream.service"
import { EXTRACTION_AGENT_SESSION_STATUS_CHANGED_CHANNEL } from "./extraction-agent-session.constants"

@Injectable()
export class ExtractionAgentSessionStatusStreamService extends PostgresStatusStreamService<ExtractionAgentSessionStatusChangedEventDto> {
  constructor() {
    super({
      channel: EXTRACTION_AGENT_SESSION_STATUS_CHANGED_CHANNEL,
      expectedType: EXTRACTION_AGENT_SESSION_STATUS_CHANGED_CHANNEL,
      serviceName: ExtractionAgentSessionStatusStreamService.name,
      isExpectedEvent: (payload) =>
        payload.type === EXTRACTION_AGENT_SESSION_STATUS_CHANGED_CHANNEL,
    })
  }
}
