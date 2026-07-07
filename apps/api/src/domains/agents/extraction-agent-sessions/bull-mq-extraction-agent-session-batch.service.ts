import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger } from "@nestjs/common"
import type { Queue } from "bullmq"
import {
  EXTRACTION_AGENT_SESSION_EXECUTE_JOB_NAME,
  EXTRACTION_AGENT_SESSION_QUEUE_NAME,
} from "./extraction-agent-session.constants"
import type { ExecuteExtractionAgentSessionJobPayload } from "./extraction-agent-session.types"
import type { ExtractionAgentSessionBatchService } from "./extraction-agent-session-batch.interface"

@Injectable()
export class BullMqExtractionAgentSessionBatchService
  implements ExtractionAgentSessionBatchService
{
  private readonly logger = new Logger(BullMqExtractionAgentSessionBatchService.name)

  constructor(
    @InjectQueue(EXTRACTION_AGENT_SESSION_QUEUE_NAME)
    private readonly executeQueue: Queue<ExecuteExtractionAgentSessionJobPayload>,
  ) {}

  async enqueueExecuteRun(payload: ExecuteExtractionAgentSessionJobPayload): Promise<void> {
    this.logger.log(
      `Enqueuing extraction execute job (extractionAgentSessionId=${payload.extractionAgentSessionId})`,
    )
    await this.executeQueue.add(EXTRACTION_AGENT_SESSION_EXECUTE_JOB_NAME, payload, {
      jobId: `execute-${payload.extractionAgentSessionId}`,
    })
  }
}
