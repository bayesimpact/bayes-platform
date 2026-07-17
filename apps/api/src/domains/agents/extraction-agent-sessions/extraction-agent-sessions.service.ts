import { Inject, Injectable, UnprocessableEntityException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { v4 } from "uuid"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "@/domains/documents/documents.service"
import type { Agent } from "../agent.entity"
import type { BaseAgentSessionType } from "../base-agent-sessions/base-agent-sessions.types"
import { ExtractionAgentSession } from "./extraction-agent-session.entity"
import {
  EXTRACTION_AGENT_SESSION_BATCH_SERVICE,
  type ExtractionAgentSessionBatchService,
} from "./extraction-agent-session-batch.interface"

@Injectable()
export class ExtractionAgentSessionsService {
  private readonly sessionConnectRepository: ConnectRepository<ExtractionAgentSession>

  constructor(
    @InjectRepository(ExtractionAgentSession)
    extractionAgentSessionRepository: Repository<ExtractionAgentSession>,
    private readonly documentsService: DocumentsService,
    @Inject(EXTRACTION_AGENT_SESSION_BATCH_SERVICE)
    private readonly batchService: ExtractionAgentSessionBatchService,
  ) {
    this.sessionConnectRepository = new ConnectRepository(
      extractionAgentSessionRepository,
      "extractionAgentSession",
    )
  }

  async executeExtraction({
    connectScope,
    agent,
    agentSettings,
    userId,
    documentId,
    promptOverride,
    type,
  }: {
    connectScope: RequiredConnectScope
    agent: Agent
    agentSettings: AgentSettings
    userId: string
    documentId: string
    promptOverride?: string
    type: BaseAgentSessionType
  }): Promise<ExtractionAgentSession> {
    if (agent.type !== "extraction") {
      throw new UnprocessableEntityException("Only extraction agents can run extraction")
    }

    if (!agentSettings.outputJsonSchema || !agentSettings.instructions) {
      throw new UnprocessableEntityException(
        "Extraction agent configuration is invalid: missing outputJsonSchema or instructions",
      )
    }

    const effectivePrompt = promptOverride ?? agentSettings.instructions
    // Validate the document exists and is in scope before enqueuing the job.
    await this.assertDocumentExists({ connectScope, documentId })

    const run = await this.sessionConnectRepository.createAndSave(connectScope, {
      agentSettingsId: agentSettings.id,
      userId,
      documentId,
      status: "pending",
      type,
      result: null,
      errorCode: null,
      errorDetails: null,
      effectivePrompt,
      traceId: v4(),
      agentId: agent.id,
    })

    // Hand off to a worker so the HTTP response is not blocked by the LLM call.
    await this.batchService.enqueueExecuteRun({
      extractionAgentSessionId: run.id,
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
    })

    return run
  }

  async listRuns({
    connectScope,
    agentId,
    type,
    userId,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    userId: string
    type: BaseAgentSessionType
  }): Promise<ExtractionAgentSession[]> {
    return this.sessionConnectRepository.find(connectScope, {
      where: { agentSettings: { agentId }, type, userId },
      relations: { agentSettings: true, document: true },
      order: { createdAt: "DESC" },
    })
  }

  async findAgentSessionById({
    connectScope,
    agentSessionId,
    type,
  }: {
    connectScope: RequiredConnectScope
    agentSessionId: string
    type: BaseAgentSessionType
  }): Promise<ExtractionAgentSession | null> {
    const runs = await this.sessionConnectRepository.find(connectScope, {
      where: { id: agentSessionId, type },
      relations: { document: true },
      take: 1,
    })
    const run = runs[0]

    if (!run) {
      return null
    }

    return run
  }

  private async assertDocumentExists({
    connectScope,
    documentId,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
  }): Promise<void> {
    const document = await this.documentsService.findById({ connectScope, documentId })
    if (!document) {
      throw new Error(`Document with ID ${documentId} not found`)
    }
  }
}
