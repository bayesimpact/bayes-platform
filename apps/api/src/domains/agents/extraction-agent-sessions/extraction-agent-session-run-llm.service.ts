import { URL } from "node:url"
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { FilePart, ImagePart, TextPart } from "ai"
import { JSONParseError, TypeValidationError } from "ai"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type {
  LLMChatMessage,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import { todaysDatePromptLine } from "@/common/utils/todays-date-prompt-line"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { Document } from "@/domains/documents/document.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "@/domains/documents/documents.service"
import { PdfPageLimitExceededError } from "@/domains/documents/pdf-pages/pdf-page-limit-exceeded.error"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PdfPagesService } from "@/domains/documents/pdf-pages/pdf-pages.service"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectRepository } from "@/domains/projects/project.repository"
import { LlmServiceBase } from "@/external/llm"
import { modelRequiresPdfAsImages } from "@/external/llm/agent-provider"
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
export class ExtractionAgentSessionRunLlmService extends LlmServiceBase {
  private readonly sessionConnectRepository: ConnectRepository<ExtractionAgentSession>

  constructor(
    @InjectRepository(ExtractionAgentSession)
    extractionAgentSessionRepository: Repository<ExtractionAgentSession>,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
    private readonly statusNotifierService: ExtractionAgentSessionStatusNotifierService,
    private readonly projectRepository: ProjectRepository,
    private readonly pdfPagesService: PdfPagesService,
    private readonly documentsService: DocumentsService,
    @Inject("_MockLLMProvider")
    mockLlmProvider: LLMProvider,
    @Inject("VertexLLMProvider")
    vertexLlmProvider: LLMProvider,
    @Inject("Vertex3LLMProvider")
    vertex3LlmProvider: LLMProvider,
    @Inject("MistralLLMProvider")
    mistralLlmProvider: LLMProvider,
    @Inject("MedGemmaLLMProvider")
    medGemmaLlmProvider: LLMProvider,
    @Inject("GemmaLLMProvider")
    gemmaLlmProvider: LLMProvider,
  ) {
    super({
      mockLlmProvider,
      vertexLlmProvider,
      vertex3LlmProvider,
      medGemmaLlmProvider,
      gemmaLlmProvider,
      mistralLlmProvider,
    })
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
      { relations: ["document", "agent", "agentSettings"] },
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
      agentSettings: run.agentSettings,
      run,
      connectScope,
    })
  }

  private async processExtraction({
    document,
    effectivePrompt,
    agent,
    agentSettings,
    run,
    connectScope,
  }: {
    document: Document
    effectivePrompt: string
    agent: Agent
    agentSettings: AgentSettings
    run: ExtractionAgentSession
    connectScope: RequiredConnectScope
  }) {
    try {
      if (!agentSettings.outputJsonSchema) {
        throw new UnprocessableEntityException("Extraction agent is missing outputJsonSchema")
      }
      const llmMessage = await this.buildLLMMessage({
        document,
        prompt: effectivePrompt,
        model: agentSettings.model,
        connectScope,
      })

      const llmFeatures = await this.projectRepository.getLlmFeatures(connectScope)
      const result = await this.getProviderForModel(agentSettings.model).generateStructuredOutput({
        message: llmMessage,
        schema: agentSettings.outputJsonSchema,
        config: this.buildLLMConfig({
          systemPrompt: todaysDatePromptLine(),
          model: agentSettings.model,
          temperature: agentSettings.temperature,
          // Extraction agent runs can be long-running; opt in to the extended
          // network timeouts on the provider fetch (see AISDKVertexProvider).
          useExtendedTimeouts: true,
          priorityCallsEnabled: agentSettings.priorityCallsEnabled,
          llmFeatures,
        }),
        metadata: this.buildLLMMetadata({ agent, agentSettings, run, connectScope }),
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
    } else if (error instanceof PdfPageLimitExceededError) {
      run.errorCode = "PDF_PAGE_LIMIT_EXCEEDED"
      run.errorDetails = { message: error.message }
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
    model,
    connectScope,
  }: {
    document: Document
    prompt: string
    model: string
    connectScope: RequiredConnectScope
  }): Promise<LLMChatMessage> {
    const llmMessage: LLMChatMessage = {
      role: "user",
      content: [{ type: "text", text: prompt }],
    }

    switch (document.mimeType) {
      case "application/pdf": {
        if (modelRequiresPdfAsImages(model)) {
          // Image-only models: send one rendered page image URL per page. The
          // pages live in GCS (rendered once by pdf-converter, cached)
          const imageUrls = await this.pdfPagesService.getImageUrls({
            document: {
              storageRelativePath: document.storageRelativePath,
              pdfPageCount: document.pdfPageCount,
            },
            onPageCountUpdate: async (pdfPageCount: number) => {
              await this.documentsService.updatePdfPageCount({
                connectScope,
                documentId: document.id,
                pdfPageCount,
              })
            },
            fileStorageService: this.fileStorageService,
          })
          const content = llmMessage.content as Array<ImagePart>
          content.push(
            ...imageUrls.map(
              (imageUrl): ImagePart => ({ type: "image", image: new URL(imageUrl) }),
            ),
          )
        } else {
          // Other models accept pdf file parts directly (signed URL; the AI
          // SDK downloads it when the provider doesn't support URLs).
          const url = await this.fileStorageService.getTemporaryUrl(document.storageRelativePath)
          const content = llmMessage.content as Array<FilePart>
          content.push({
            type: "file",
            mediaType: "application/pdf",
            data: new URL(url),
            filename: document.fileName,
          })
        }
        break
      }
      case "image/png":
      case "image/jpeg":
      case "image/jpg": {
        const url = await this.fileStorageService.getTemporaryUrl(document.storageRelativePath)
        const content = llmMessage.content as Array<ImagePart>
        content.push({
          type: "image",
          image: new URL(url),
        })
        break
      }
      case "text/plain":
      case "text/markdown":
      case "text/csv": {
        const fileBuffer = await this.fileStorageService.readFile(document.storageRelativePath)
        const content = llmMessage.content as Array<TextPart>
        content.push({
          type: "text",
          text: fileBuffer.toString("utf-8"),
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
    agentSettings,
    run,
    connectScope,
  }: {
    agent: Agent
    agentSettings: AgentSettings
    run: ExtractionAgentSession
    connectScope: RequiredConnectScope
  }): LLMMetadata {
    return {
      traceId: run.traceId,
      organizationId: connectScope.organizationId,
      agentSessionId: run.id,
      agentId: agent.id,
      revision: agentSettings.revision,
      projectId: connectScope.projectId,
      currentTurn: 1,
      tags: [agent.name, `rev-${agentSettings.revision}`, agent.type],
    }
  }
}
