import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: DataSource required at runtime for NestJS DI
import { DataSource, type Repository } from "typeorm"
import { v4 } from "uuid"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type {
  LLMChatMessage,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import type { AgentWithSettingsRunJobPayload } from "@/domains/agents/shared/agent-with-settings-run.types"
import { ServiceWithLLM } from "@/external/llm"
import type {
  AgentCsvExtractionRunColumnSchema,
  AgentCsvExtractionRunSummary,
} from "./agent-csv-extraction-run.entity"
import { AgentCsvExtractionRun } from "./agent-csv-extraction-run.entity"
import type { ProcessAgentCsvExtractionRunRecordJobPayload } from "./agent-csv-extraction-run.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunCsvExportService } from "./agent-csv-extraction-run-csv-export.service"
import {
  AgentCsvExtractionRunRecord,
  type AgentCsvExtractionRunRecordStatus,
} from "./agent-csv-extraction-run-record.entity"
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
    @Inject("Vertex3LLMProvider")
    vertex3LlmProvider: LLMProvider,
    @Inject("MistralLLMProvider")
    mistralLlmProvider: LLMProvider,
    @Inject("MedGemmaLLMProvider")
    medGemmaLlmProvider: LLMProvider,
    @Inject("GemmaLLMProvider")
    gemmaLlmProvider: LLMProvider,
    private readonly dataSource: DataSource,
  ) {
    super({
      mockLlmProvider,
      vertexLlmProvider,
      vertex3LlmProvider,
      medGemmaLlmProvider,
      gemmaLlmProvider,
      mistralLlmProvider,
    })
    this.runConnectRepository = new ConnectRepository(runRepository, "agentCsvExtractionRun")
    this.runRecordConnectRepository = new ConnectRepository(
      runRecordRepository,
      "agentCsvExtractionRunRecord",
    )
  }

  async processRunRecord(payload: ProcessAgentCsvExtractionRunRecordJobPayload): Promise<void> {
    const { connectScope, agentCsvExtractionRun, runRecordId, agentWithSettings } = payload

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

    if (runRecord.status !== "running") {
      this.logger.warn(
        `Agent CSV run record ${runRecordId} is in status "${runRecord.status}" and cannot be processed`,
      )
      return
    }

    await this.processOneRecord({
      runRecord,
      columnSchema: payload.columnSchema,
      agentWithSettings,
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

    await this.recomputeSummaryAndMaybeComplete({
      connectScope,
      agentCsvExtractionRunId: agentCsvExtractionRun.id,
    })
  }

  /**
   * Recomputes the run summary from the run-record table and, when the run reaches a
   * terminal state, transitions its status and triggers the one-off side effects.
   *
   * This is safe to call concurrently from multiple workers: a pessimistic lock on the
   * run row serializes summary updates per run, and the counts are derived from the
   * records table rather than mutated in place, so the result is idempotent even when a
   * record job is retried. The terminal transition is guarded by `status = 'running'` so
   * it (and the CSV export) fires exactly once.
   */
  private async recomputeSummaryAndMaybeComplete({
    connectScope,
    agentCsvExtractionRunId,
  }: {
    connectScope: RequiredConnectScope
    agentCsvExtractionRunId: string
  }): Promise<void> {
    const shouldGenerateCsv = await this.dataSource.transaction(async (entityManager) => {
      const runRepository = entityManager.getRepository(AgentCsvExtractionRun)
      const runRecordRepository = entityManager.getRepository(AgentCsvExtractionRunRecord)

      // Serialize summary updates for this run across concurrent record jobs. The last
      // job to acquire the lock therefore observes every committed record status.
      const run = await runRepository
        .createQueryBuilder("run")
        .setLock("pessimistic_write")
        .where("run.id = :id", { id: agentCsvExtractionRunId })
        .andWhere("run.organization_id = :organizationId", {
          organizationId: connectScope.organizationId,
        })
        .andWhere("run.project_id = :projectId", { projectId: connectScope.projectId })
        .getOne()

      if (!run || !run.summary) {
        throw new Error(`Run ${agentCsvExtractionRunId} has no summary to update`)
      }

      const rows = await runRecordRepository
        .createQueryBuilder("record")
        .select("record.status", "status")
        .addSelect("COUNT(*)", "count")
        .where("record.agent_csv_extraction_run_id = :runId", {
          runId: agentCsvExtractionRunId,
        })
        .andWhere("record.organization_id = :organizationId", {
          organizationId: connectScope.organizationId,
        })
        .andWhere("record.project_id = :projectId", { projectId: connectScope.projectId })
        .groupBy("record.status")
        .getRawMany<{ status: AgentCsvExtractionRunRecordStatus; count: string }>()

      const countByStatus = (status: AgentCsvExtractionRunRecordStatus): number =>
        Number(rows.find((row) => row.status === status)?.count ?? 0)

      const summary: AgentCsvExtractionRunSummary = {
        total: run.summary.total,
        processed: countByStatus("success"),
        errors: countByStatus("error"),
        running: countByStatus("running"),
      }

      await runRepository.update({ id: agentCsvExtractionRunId }, { summary })

      // A cancelled run keeps its terminal status and never produces an export.
      if (run.status === "cancelled") {
        return false
      }

      const isCompleted =
        summary.running === 0 && summary.processed + summary.errors === summary.total
      if (!isCompleted) {
        return false
      }

      // A run whose records all errored failed outright; otherwise it completed, even
      // when some individual records errored.
      const finalStatus = summary.errors > 0 && summary.processed === 0 ? "failed" : "completed"
      const result = await runRepository
        .createQueryBuilder()
        .update()
        .set({ status: finalStatus })
        .where("id = :id", { id: agentCsvExtractionRunId })
        .andWhere("status = :running", { running: "running" })
        .execute()
      // Only the worker that actually transitioned the run owns the one-off CSV export.
      return result.affected === 1
    })

    const updatedRun = await this.getAgentCsvExtractionRun({
      id: agentCsvExtractionRunId,
      connectScope,
    })
    // Generated outside the transaction so the run-row lock is not held during the
    // (potentially slow) export.
    if (shouldGenerateCsv) {
      await this.generateCsv(updatedRun)
    }
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
    agentWithSettings,
    agentCsvExtractionRun,
    connectScope,
  }: {
    runRecord: AgentCsvExtractionRunRecord
    columnSchema: AgentCsvExtractionRunColumnSchema
    agentWithSettings: AgentWithSettingsRunJobPayload
    agentCsvExtractionRun: AgentCsvExtractionRun
    connectScope: RequiredConnectScope
  }): Promise<void> {
    try {
      const inputText = this.buildInputText({
        inputData: runRecord.inputData ?? {},
        columnSchema,
      })

      const { output: agentOutput, traceId } = await this.invokeAgent({
        agentWithSettings,
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

    await this.recomputeSummaryAndMaybeComplete({
      connectScope,
      agentCsvExtractionRunId: agentCsvExtractionRun.id,
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
    agentWithSettings,
    inputText,
    connectScope,
  }: {
    agentWithSettings: AgentWithSettingsRunJobPayload
    inputText: string
    connectScope: RequiredConnectScope
  }): Promise<{ output: Record<string, unknown>; traceId: string }> {
    if (!agentWithSettings.outputJsonSchema) {
      throw new UnprocessableEntityException(
        "Agent must have an outputJsonSchema for CSV extraction runs",
      )
    }

    const traceId = v4()
    const llmMessage: LLMChatMessage = {
      role: "user",
      content: [{ type: "text", text: inputText }],
    }

    const systemPrompt = `${agentWithSettings.instructions}\n\nToday's date: ${new Date().toLocaleDateString()}`

    const llmConfig = this.buildLLMConfig({
      systemPrompt,
      model: agentWithSettings.model,
      temperature: agentWithSettings.temperature,
    })

    const llmMetadata: LLMMetadata = {
      traceId,
      agentSessionId: traceId,
      currentTurn: 1,
      organizationId: connectScope.organizationId,
      agentId: agentWithSettings.id,
      revision: agentWithSettings.revision,
      projectId: connectScope.projectId,
      tags: [
        agentWithSettings.name,
        "agent-csv-extraction-run",
        `rev-${agentWithSettings.revision}`,
      ],
    }

    const output = await this.getProviderForModel(agentWithSettings.model).generateStructuredOutput(
      {
        message: llmMessage,
        schema: agentWithSettings.outputJsonSchema,
        config: llmConfig,
        metadata: llmMetadata,
      },
    )

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
      agentSettingsId: agentCsvExtractionRun.agentSettingsId,
      status: agentCsvExtractionRun.status,
      summary: agentCsvExtractionRun.summary,
      updatedAt: agentCsvExtractionRun.updatedAt.getTime(),
    })
  }
}
