import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { v4 } from "uuid"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type {
  LLMChatMessage,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import type { Agent } from "@/domains/agents/agent.entity"
import { ServiceWithLLM } from "@/external/llm"
import type { AgentCsvExtractionRunColumnSchema } from "./agent-csv-extraction-run.entity"
import { AgentCsvExtractionRun } from "./agent-csv-extraction-run.entity"
import type { ProcessAgentCsvExtractionRunRecordJobPayload } from "./agent-csv-extraction-run.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunCsvExportService } from "./agent-csv-extraction-run-csv-export.service"
import { AgentCsvExtractionRunRecord } from "./agent-csv-extraction-run-record.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunStatusNotifierService } from "./agent-csv-extraction-run-status-notifier.service"

@Injectable()
export class AgentCsvExtractionRunProcessorService extends ServiceWithLLM {
  private readonly logger = new Logger(AgentCsvExtractionRunProcessorService.name)
  private readonly runConnectRepository: ConnectRepository<AgentCsvExtractionRun>
  private readonly runRecordConnectRepository: ConnectRepository<AgentCsvExtractionRunRecord>

  constructor(
    @InjectRepository(AgentCsvExtractionRun)
    runRepository: Repository<AgentCsvExtractionRun>,
    @InjectRepository(AgentCsvExtractionRunRecord)
    runRecordRepository: Repository<AgentCsvExtractionRunRecord>,
    private readonly statusNotifierService: AgentCsvExtractionRunStatusNotifierService,
    private readonly csvExportService: AgentCsvExtractionRunCsvExportService,
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
    this.runConnectRepository = new ConnectRepository(runRepository, "agentCsvExtractionRun")
    this.runRecordConnectRepository = new ConnectRepository(
      runRecordRepository,
      "agentCsvExtractionRunRecord",
    )
  }

  async processRunRecord(payload: ProcessAgentCsvExtractionRunRecordJobPayload): Promise<void> {
    const { connectScope, agentCsvExtractionRun, runRecordId, agent } = payload

    const runRecord = await this.runRecordConnectRepository.getOneById(connectScope, runRecordId)
    if (!runRecord) {
      throw new NotFoundException(`Agent CSV run record with id ${runRecordId} not found`)
    }

    if (runRecord.status === "success") {
      this.logger.log(
        `Agent CSV run record ${runRecordId} already processed (status=success); skipping`,
      )
      return
    }

    if (
      agentCsvExtractionRun.status === "cancelled" ||
      agentCsvExtractionRun.status === "completed"
    ) {
      this.logger.log(
        `Agent CSV run ${agentCsvExtractionRun.id} is ${agentCsvExtractionRun.status}; skipping record ${runRecordId}`,
      )
      return
    }

    await this.processOneRecord({
      runRecord,
      columnSchema: payload.columnSchema,
      agent,
      agentCsvExtractionRun,
      connectScope,
    })
  }

  async markRecordFailed(
    payload: ProcessAgentCsvExtractionRunRecordJobPayload,
    error: Error,
  ): Promise<void> {
    const { connectScope, agentCsvExtractionRun } = payload

    const runRecord = await this.runRecordConnectRepository.getOneById(
      connectScope,
      payload.runRecordId,
    )
    if (!runRecord) {
      this.logger.warn(`markRecordFailed: run record ${payload.runRecordId} not found`)
      return
    }

    if (runRecord.status !== "running") return

    runRecord.status = "error"
    runRecord.errorDetails = error.message ?? "Unknown error"
    runRecord.agentRawOutput = null
    runRecord.traceId = null
    await this.runRecordConnectRepository.saveOne(runRecord)

    await this.incrementSummary({
      connectScope,
      agentCsvExtractionRunId: agentCsvExtractionRun.id,
      runRecord,
    })
  }

  private async incrementSummary({
    connectScope,
    agentCsvExtractionRunId,
    runRecord,
  }: {
    connectScope: RequiredConnectScope
    agentCsvExtractionRunId: string
    runRecord: AgentCsvExtractionRunRecord
  }): Promise<void> {
    const run = await this.getAgentCsvExtractionRun({ id: agentCsvExtractionRunId, connectScope })
    const summary = run.summary
    if (!summary) {
      throw new Error(`Run ${agentCsvExtractionRunId} has no summary to increment`)
    }

    if (runRecord.status === "success") {
      summary.processed += 1
      summary.running -= 1
    } else if (runRecord.status === "error") {
      summary.errors += 1
      summary.running -= 1
    }

    await this.runConnectRepository.updateOneById({
      connectScope,
      id: agentCsvExtractionRunId,
      fields: { summary },
    })

    const isCompleted =
      summary.running === 0 && summary.processed + summary.errors === summary.total
    if (isCompleted && run.status !== "cancelled") {
      const newStatus = summary.errors > 0 && summary.processed === 0 ? "failed" : "completed"
      await this.runConnectRepository.updateOneById({
        connectScope,
        id: agentCsvExtractionRunId,
        fields: { status: newStatus },
      })
      const updatedRun = await this.getAgentCsvExtractionRun({
        id: agentCsvExtractionRunId,
        connectScope,
      })
      await this.generateCsv(updatedRun)
      await this.notifyStatusChanged(updatedRun)
      return
    }

    if (summary.errors > 0 && run.status === "running") {
      await this.runConnectRepository.updateOneById({
        connectScope,
        id: agentCsvExtractionRunId,
        fields: { status: "failed" },
      })
    }

    const updatedRun = await this.getAgentCsvExtractionRun({
      id: agentCsvExtractionRunId,
      connectScope,
    })
    await this.notifyStatusChanged(updatedRun)
  }

  private async getAgentCsvExtractionRun({
    id,
    connectScope,
  }: {
    id: string
    connectScope: RequiredConnectScope
  }): Promise<AgentCsvExtractionRun> {
    const run = await this.runConnectRepository.getOneById(connectScope, id)
    if (!run) {
      throw new NotFoundException(`Agent CSV run with id ${id} not found`)
    }
    return run
  }

  private async processOneRecord({
    runRecord,
    columnSchema,
    agent,
    agentCsvExtractionRun,
    connectScope,
  }: {
    runRecord: AgentCsvExtractionRunRecord
    columnSchema: AgentCsvExtractionRunColumnSchema
    agent: Agent
    agentCsvExtractionRun: AgentCsvExtractionRun
    connectScope: RequiredConnectScope
  }): Promise<void> {
    try {
      const inputText = this.buildInputText({
        inputData: runRecord.inputData ?? {},
        columnSchema,
      })

      const { output: agentOutput, traceId } = await this.invokeAgent({
        agent,
        inputText,
        connectScope,
      })

      runRecord.status = "success"
      runRecord.agentRawOutput = agentOutput
      runRecord.errorDetails = null
      runRecord.traceId = traceId
      await this.runRecordConnectRepository.saveOne(runRecord)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error during agent invocation"

      runRecord.status = "error"
      runRecord.agentRawOutput = null
      runRecord.errorDetails = errorMessage
      runRecord.traceId = null
      await this.runRecordConnectRepository.saveOne(runRecord)
    }

    await this.incrementSummary({
      connectScope,
      agentCsvExtractionRunId: agentCsvExtractionRun.id,
      runRecord,
    })
  }

  private buildInputText({
    inputData,
    columnSchema,
  }: {
    inputData: Record<string, unknown>
    columnSchema: AgentCsvExtractionRunColumnSchema
  }): string {
    const inputColumns = Object.values(columnSchema)
      .filter((column) => column.role === "input")
      .sort((columnA, columnB) => columnA.index - columnB.index)

    const lines: string[] = []
    for (const column of inputColumns) {
      const value = inputData[column.id]
      lines.push(`${column.finalName}: ${value ?? ""}`)
    }
    return lines.join("\n")
  }

  private async invokeAgent({
    agent,
    inputText,
    connectScope,
  }: {
    agent: Agent
    inputText: string
    connectScope: RequiredConnectScope
  }): Promise<{ output: Record<string, unknown>; traceId: string }> {
    if (!agent.outputJsonSchema) {
      throw new UnprocessableEntityException(
        "Agent must have an outputJsonSchema for CSV extraction runs",
      )
    }

    const traceId = v4()
    const llmMessage: LLMChatMessage = {
      role: "user",
      content: [{ type: "text", text: inputText }],
    }

    const systemPrompt = `Today's date: ${new Date().toLocaleDateString()}\n\n${agent.defaultPrompt}`

    const llmConfig = this.buildLLMConfig({
      systemPrompt,
      model: agent.model,
      temperature: agent.temperature,
    })

    const llmMetadata: LLMMetadata = {
      traceId,
      agentSessionId: traceId,
      currentTurn: 1,
      organizationId: connectScope.organizationId,
      agentId: agent.id,
      projectId: connectScope.projectId,
      tags: [agent.name, "agent-csv-extraction-run"],
    }

    const output = await this.getProviderForModel(agent.model).generateStructuredOutput({
      message: llmMessage,
      schema: agent.outputJsonSchema,
      config: llmConfig,
      metadata: llmMetadata,
    })

    return { output, traceId }
  }

  private async generateCsv(agentCsvExtractionRun: AgentCsvExtractionRun): Promise<void> {
    try {
      await this.csvExportService.generateAndStoreDocument(agentCsvExtractionRun)
    } catch (error) {
      this.logger.error(
        `Failed to generate CSV export for run ${agentCsvExtractionRun.id}: ${(error as Error).message}`,
        (error as Error).stack,
      )
    }
  }

  private async notifyStatusChanged(agentCsvExtractionRun: AgentCsvExtractionRun): Promise<void> {
    await this.statusNotifierService.notifyRunStatusChanged({
      agentCsvExtractionRunId: agentCsvExtractionRun.id,
      organizationId: agentCsvExtractionRun.organizationId,
      projectId: agentCsvExtractionRun.projectId,
      agentId: agentCsvExtractionRun.agentId,
      status: agentCsvExtractionRun.status,
      summary: agentCsvExtractionRun.summary,
      updatedAt: agentCsvExtractionRun.updatedAt.getTime(),
    })
  }
}
