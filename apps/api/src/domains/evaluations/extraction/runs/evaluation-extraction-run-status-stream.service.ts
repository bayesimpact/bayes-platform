import type { EvaluationExtractionRunStatusChangedEventDto } from "@bayes-platform/api-contracts"
import { Injectable } from "@nestjs/common"
import { PostgresStatusStreamService } from "@/common/sse/postgres-status-stream.service"
import { EVALUATION_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL } from "./evaluation-extraction-run.constants"

@Injectable()
export class EvaluationExtractionRunStatusStreamService extends PostgresStatusStreamService<EvaluationExtractionRunStatusChangedEventDto> {
  constructor() {
    super({
      channel: EVALUATION_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL,
      expectedType: EVALUATION_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL,
      serviceName: EvaluationExtractionRunStatusStreamService.name,
      isExpectedEvent: (payload) =>
        payload.type === EVALUATION_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL,
    })
  }
}
