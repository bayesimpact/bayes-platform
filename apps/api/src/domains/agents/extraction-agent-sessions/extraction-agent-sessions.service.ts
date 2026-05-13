import { URL } from "node:url"
import { Inject, Injectable, UnprocessableEntityException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { FilePart, ImagePart } from "ai"
import { JSONParseError, TypeValidationError } from "ai"
import * as Papa from "papaparse"
import type { Repository } from "typeorm"
import { v4 } from "uuid"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type {
  LLMChatMessage,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import type { Document } from "@/domains/documents/document.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "@/domains/documents/documents.service"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import { ServiceWithLLM } from "@/external/llm"
import type { Agent } from "../agent.entity"
import type { BaseAgentSessionType } from "../base-agent-sessions/base-agent-sessions.types"
import { ExtractionAgentSession } from "./extraction-agent-session.entity"

@Injectable()
export class ExtractionAgentSessionsService extends ServiceWithLLM {
  constructor(
    @InjectRepository(ExtractionAgentSession)
    extractionAgentSessionRepository: Repository<ExtractionAgentSession>,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
    private readonly documentsService: DocumentsService,
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

  private readonly sessionConnectRepository: ConnectRepository<ExtractionAgentSession>

  async executeExtraction({
    connectScope,
    agent,
    userId,
    documentId,
    promptOverride,
    type,
  }: {
    connectScope: RequiredConnectScope
    agent: Agent
    userId: string
    documentId: string
    promptOverride?: string
    type: BaseAgentSessionType
  }): Promise<ExtractionAgentSession> {
    if (agent.type !== "extraction") {
      throw new UnprocessableEntityException("Only extraction agents can run extraction")
    }

    if (!agent.outputJsonSchema || !agent.defaultPrompt) {
      throw new UnprocessableEntityException(
        "Extraction agent configuration is invalid: missing outputJsonSchema or defaultPrompt",
      )
    }

    const effectivePrompt = promptOverride ?? agent.defaultPrompt
    const document = await this.getDocument({ connectScope, documentId })

    const run = await this.sessionConnectRepository.createAndSave(connectScope, {
      agentId: agent.id,
      userId,
      documentId,
      status: "failed",
      type,
      result: null,
      errorCode: null,
      errorDetails: null,
      effectivePrompt,
      schemaSnapshot: agent.outputJsonSchema,
      traceId: v4(),
    })

    return this.processExtraction({ document, effectivePrompt, agent, run, connectScope })
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
        }),
        metadata: this.buildLLMMetadata({ agent, run, connectScope }),
      })

      run.status = "success"
      run.result = result
      run.errorCode = null
      run.errorDetails = null
      return await this.sessionConnectRepository.saveOne(run)
    } catch (error) {
      return await this.handleExtractionError({ run, error })
    }
  }

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: This method is currently unused but may be needed for future CSV processing
  private async _processCsvExtraction({
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
      const rows = await this.parseCsvRows(document)
      const provider = this.getProviderForModel(agent.model)
      const config = this.buildLLMConfig({
        systemPrompt: `Today's date: ${new Date().toLocaleDateString()}`,
        model: agent.model,
        temperature: agent.temperature,
      })
      const metadata = this.buildLLMMetadata({ agent, run, connectScope })

      const rowResults: Record<string, unknown>[] = []
      for (const row of rows) {
        const rowResult = await provider.generateStructuredOutput({
          message: {
            role: "user",
            content: [{ type: "text", text: `${effectivePrompt}\n\n${this.formatCsvRow(row)}` }],
          },
          schema: agent.outputJsonSchema,
          config,
          metadata,
        })
        rowResults.push(rowResult)
      }

      run.status = "success"
      run.result = { rows: rowResults }
      run.errorCode = null
      run.errorDetails = null
      return await this.sessionConnectRepository.saveOne(run)
    } catch (error) {
      return await this.handleExtractionError({ run, error })
    }
  }

  private async handleExtractionError({
    run,
    error,
  }: {
    run: ExtractionAgentSession
    error: unknown
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
      await this.sessionConnectRepository.saveOne(run)
      throw new UnprocessableEntityException("Model output does not match outputJsonSchema")
    }

    run.errorCode = "EXTRACTION_PROVIDER_ERROR"
    run.errorDetails = {
      message: error instanceof Error ? error.message : "Unknown extraction provider error",
    }
    await this.sessionConnectRepository.saveOne(run)
    throw error
  }

  private async parseCsvRows(document: Document): Promise<Record<string, unknown>[]> {
    const buffer = await this.fileStorageService.readFile(document.storageRelativePath)
    const csvContent = buffer.toString("utf-8")

    const parsed = Papa.parse<Record<string, unknown>>(csvContent, {
      skipEmptyLines: true,
      header: true,
    })

    if (!parsed.meta.fields || parsed.meta.fields.length === 0) {
      throw new UnprocessableEntityException("CSV file has no columns")
    }

    return parsed.data
  }

  private formatCsvRow(row: Record<string, unknown>): string {
    return Object.entries(row)
      .map(([key, value]) => `${key}: ${value ?? ""}`)
      .join("\n")
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
      where: { agentId, type, userId },
      relations: { document: true },
      order: { createdAt: "DESC" },
    })
  }

  async findAgentSessionById({
    connectScope,
    agentSessionId,
    agentId,
    type,
  }: {
    connectScope: RequiredConnectScope
    agentSessionId: string
    agentId: string
    type: BaseAgentSessionType
  }): Promise<ExtractionAgentSession | null> {
    const runs = await this.sessionConnectRepository.find(connectScope, {
      where: { id: agentSessionId, agentId, type },
      relations: { document: true },
      take: 1,
    })
    const run = runs[0]

    if (!run) {
      return null
    }

    return run
  }

  private async getDocument({
    connectScope,
    documentId,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
  }): Promise<Document> {
    const document = await this.documentsService.findById({ connectScope, documentId })
    if (!document) {
      throw new Error(`Document with ID ${documentId} not found`)
    }
    return document
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
