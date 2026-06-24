import { URL } from "node:url"
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { FilePart, ImagePart } from "ai"
import { JSONParseError, TypeValidationError } from "ai"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type {
  LLMChatMessage,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import type { Document } from "@/domains/documents/document.entity"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import { ServiceWithLLM } from "@/external/llm"
import type { Agent } from "../agent.entity"
import { ExtractionAgentSession } from "./extraction-agent-session.entity"
import type { ExecuteExtractionAgentSessionJobPayload } from "./extraction-agent-session.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ExtractionAgentSessionStatusNotifierService } from "./extraction-agent-session-status-notifier.service"

/**
 * Worker-side service that performs the actual LLM extraction for a single
 * {@link ExtractionAgentSession}. It is invoked from the BullMQ execute worker
 * (out of the request path) so the HTTP response can return immediately while
 * the LLM call resolves in a worker process.
 */
@Injectable()
export class ExtractionAgentSessionRunnerService extends ServiceWithLLM {
  private readonly sessionConnectRepository: ConnectRepository<ExtractionAgentSession>

  constructor(
    @InjectRepository(ExtractionAgentSession)
    extractionAgentSessionRepository: Repository<ExtractionAgentSession>,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
    private readonly statusNotifierService: ExtractionAgentSessionStatusNotifierService,
    @Inject("_MockLLMProvider")
    mockLlmProvider: LLMProvider,
    @Inject("VertexLLMProvider")
    vertexLlmProvider: LLMProvider,
    @Inject("MedGemmaLLMProvider")
    medGemmaLlmProvider: LLMProvider,
    @Inject("GemmaLLMProvider")
    gemmaLlmProvider: LLMProvider,
  ) {
    super({ mockLlmProvider, vertexLlmProvider, medGemmaLlmProvider, gemmaLlmProvider })
    this.sessionConnectRepository = new ConnectRepository(
      extractionAgentSessionRepository,
      "extractionAgentSession",
    )
  }

  async runById(payload: ExecuteExtractionAgentSessionJobPayload): Promise<void> {
    const { extractionAgentSessionId, organizationId, projectId } = payload
    const connectScope: RequiredConnectScope = { organizationId, projectId }

    const run = await this.sessionConnectRepository.getOneById(
      connectScope,
      extractionAgentSessionId,
      { relations: ["document", "agent"] },
    )
    if (!run) {
      throw new NotFoundException(
        `Extraction agent session with id ${extractionAgentSessionId} not found`,
      )
    }

    await this.processExtraction({
      document: run.document,
      effectivePrompt: run.effectivePrompt,
      agent: run.agent,
      run,
      connectScope,
    })
  }

  private async processExtraction({
    document,
    effectivePrompt,
    agent,
    run,
    connectScope,
  }: {
    document: Document
    effectivePrompt: string
    agent: Agent
    run: ExtractionAgentSession
    connectScope: RequiredConnectScope
  }) {
    if (!agent.outputJsonSchema) {
      throw new UnprocessableEntityException("Extraction agent is missing outputJsonSchema")
    }

    try {
      const llmMessage = await this.buildLLMMessage({
        document,
        prompt: effectivePrompt,
      })

      const result = await this.getProviderForModel(agent.model).generateStructuredOutput({
        message: llmMessage,
        schema: agent.outputJsonSchema,
        config: this.buildLLMConfig({
          systemPrompt: `Today's date: ${new Date().toLocaleDateString()}`,
          model: agent.model,
          temperature: agent.temperature,
          // Extraction agent runs can be long-running; opt in to the extended
          // network timeouts on the provider fetch (see AISDKVertexProvider).
          useExtendedTimeouts: true,
        }),
        metadata: this.buildLLMMetadata({ agent, run, connectScope }),
      })

      run.status = "success"
      run.result = result
      run.errorCode = null
      run.errorDetails = null
      const savedRun = await this.sessionConnectRepository.saveOne(run)
      await this.statusNotifierService.notifySessionStatusChanged({
        extractionAgentSessionId: savedRun.id,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
        agentId: agent.id,
        status: savedRun.status,
        updatedAt: savedRun.updatedAt.getTime(),
      })
      return savedRun
    } catch (error) {
      return await this.handleExtractionError({ run, error, connectScope, agentId: agent.id })
    }
  }

  private async handleExtractionError({
    run,
    error,
    connectScope,
    agentId,
  }: {
    run: ExtractionAgentSession
    error: unknown
    connectScope: RequiredConnectScope
    agentId: string
  }): Promise<ExtractionAgentSession> {
    run.status = "failed"
    run.result = null

    const isSchemaValidationError =
      TypeValidationError.isInstance(error) ||
      JSONParseError.isInstance(error) ||
      (error instanceof Error &&
        (error.name === "TypeValidationError" || error.name === "JSONParseError"))

    if (isSchemaValidationError) {
      run.errorCode = "SCHEMA_VALIDATION_FAILED"
      run.errorDetails = { message: (error as Error).message }
    } else {
      run.errorCode = "EXTRACTION_PROVIDER_ERROR"
      run.errorDetails = {
        message: error instanceof Error ? error.message : "Unknown extraction provider error",
      }
    }

    const savedRun = await this.sessionConnectRepository.saveOne(run)
    await this.statusNotifierService.notifySessionStatusChanged({
      extractionAgentSessionId: savedRun.id,
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
      agentId,
      status: savedRun.status,
      updatedAt: savedRun.updatedAt.getTime(),
    })
    throw error
  }

  private async buildLLMMessage({
    document,
    prompt,
  }: {
    document: Document
    prompt: string
  }): Promise<LLMChatMessage> {
    const url = await this.fileStorageService.getTemporaryUrl(document.storageRelativePath)
    const llmMessage: LLMChatMessage = {
      role: "user",
      content: [{ type: "text", text: prompt }],
    }

    switch (document.mimeType) {
      case "application/pdf": {
        const content = llmMessage.content as Array<FilePart>
        content.push({
          type: "file",
          mediaType: "application/pdf",
          data: new URL(url),
          filename: document.fileName,
        })
        break
      }
      case "image/png":
      case "image/jpeg":
      case "image/jpg": {
        const content = llmMessage.content as Array<ImagePart>
        content.push({
          type: "image",
          image: new URL(url),
        })
        break
      }

      default:
        throw new UnprocessableEntityException(`Unsupported document type: ${document.mimeType}`)
    }

    return llmMessage
  }

  private buildLLMMetadata({
    agent,
    run,
    connectScope,
  }: {
    agent: Agent
    run: ExtractionAgentSession
    connectScope: RequiredConnectScope
  }): LLMMetadata {
    return {
      traceId: run.traceId,
      organizationId: connectScope.organizationId,
      agentSessionId: run.id,
      agentId: agent.id,
      projectId: connectScope.projectId,
      currentTurn: 1,
      tags: [agent.name, "extraction"],
    }
  }
}
