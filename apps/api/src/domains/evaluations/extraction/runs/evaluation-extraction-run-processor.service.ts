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
import type { Agent } from "@/domains/agents/agent.entity"
import { ServiceWithLLM } from "@/external/llm"
import type {
  DatasetSchemaColumn,
  EvaluationExtractionDatasetSchemaMapping,
} from "../datasets/evaluation-extraction-dataset.entity"
import type { EvaluationExtractionDatasetRecord } from "../datasets/records/evaluation-extraction-dataset-record.entity"
import {
  EvaluationExtractionRun,
  type EvaluationExtractionRunSummary,
} from "./evaluation-extraction-run.entity"
import type { ProcessEvaluationExtractionRunRecordJobPayload } from "./evaluation-extraction-run.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunCsvExportService } from "./evaluation-extraction-run-csv-export.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunGraderService } from "./evaluation-extraction-run-grader.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunStatusNotifierService } from "./evaluation-extraction-run-status-notifier.service"
import {
  EvaluationExtractionRunRecord,
  type EvaluationExtractionRunRecordStatus,
} from "./records/evaluation-extraction-run-record.entity"

@Injectable()
export class EvaluationExtractionRunProcessorService extends ServiceWithLLM {
  private readonly logger = new Logger(EvaluationExtractionRunProcessorService.name)
  private readonly evaluationExtractionRunConnectRepository: ConnectRepository<EvaluationExtractionRun>
  private readonly runRecordConnectRepository: ConnectRepository<EvaluationExtractionRunRecord>

  constructor(
    @InjectRepository(EvaluationExtractionRun)
    evaluationExtractionRunRepository: Repository<EvaluationExtractionRun>,
    @InjectRepository(EvaluationExtractionRunRecord)
    evaluationExtractionRunRecordRepository: Repository<EvaluationExtractionRunRecord>,
    private readonly graderService: EvaluationExtractionRunGraderService,
    private readonly statusNotifierService: EvaluationExtractionRunStatusNotifierService,
    private readonly csvExportService: EvaluationExtractionRunCsvExportService,
    @Inject("_MockLLMProvider")
    mockLlmProvider: LLMProvider,
    @Inject("VertexLLMProvider")
    vertexLlmProvider: LLMProvider,
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
      medGemmaLlmProvider,
      gemmaLlmProvider,
      mistralLlmProvider,
    })
    this.evaluationExtractionRunConnectRepository = new ConnectRepository(
      evaluationExtractionRunRepository,
      "evaluationExtractionRun",
    )
    this.runRecordConnectRepository = new ConnectRepository(
      evaluationExtractionRunRecordRepository,
      "evaluationExtractionRunRecord",
    )
  }

  async processRunRecord(payload: ProcessEvaluationExtractionRunRecordJobPayload): Promise<void> {
    const { connectScope, evaluationExtractionRun, runRecordId, agent } = payload

    const runRecord = await this.runRecordConnectRepository.getOneById(connectScope, runRecordId, {
      relations: ["evaluationExtractionDatasetRecord"],
    })
    if (!runRecord) {
      throw new NotFoundException(`Evaluation run record with id ${runRecordId} not found`)
    }
    if (!runRecord.evaluationExtractionDatasetRecord) {
      throw new NotFoundException(
        `Evaluation dataset record for run record ${runRecordId} not found`,
      )
    }

    if (runRecord.status === "match" || runRecord.status === "mismatch") {
      this.logger.log(
        `Evaluation run record ${runRecordId} already processed (status=${runRecord.status}); skipping`,
      )
      return
    }

    if (
      evaluationExtractionRun.status === "cancelled" ||
      evaluationExtractionRun.status === "completed"
    ) {
      this.logger.log(
        `Evaluation run ${evaluationExtractionRun.id} is ${evaluationExtractionRun.status}; skipping record ${runRecordId}`,
      )
      return
    }

    if (runRecord.status !== "running") {
      this.logger.warn(
        `Evaluation run record ${runRecordId} is in status "${runRecord.status}" and cannot be processed`,
      )
      return
    }

    await this.processOneRecord({
      runRecord,
      datasetRecord: runRecord.evaluationExtractionDatasetRecord,
      schemaMapping: payload.schemaMapping,
      agent,
      evaluationExtractionRun,
      connectScope,
    })
  }

  /**
   * Recomputes the run summary from the run-record table and, when the run reaches a
   * terminal state, transitions its status and triggers the one-off side effects.
   *
   * This is safe to call concurrently from multiple workers: a pessimistic lock on the
   * run row serializes summary updates per run, and the counts are derived from the
   * records table rather than mutated in place, so the result is idempotent even when a
   * record job is retried. Terminal transitions are guarded by `status = 'running'` so
   * they (and the CSV export) fire exactly once.
   */
  private async recomputeSummaryAndMaybeComplete({
    connectScope,
    evaluationExtractionRunId,
  }: {
    connectScope: RequiredConnectScope
    evaluationExtractionRunId: string
  }): Promise<void> {
    const shouldGenerateCsv = await this.dataSource.transaction(async (entityManager) => {
      const runRepository = entityManager.getRepository(EvaluationExtractionRun)
      const runRecordRepository = entityManager.getRepository(EvaluationExtractionRunRecord)

      // Serialize summary updates for this run across concurrent record jobs. The last
      // job to acquire the lock therefore observes every committed record status.
      const run = await runRepository
        .createQueryBuilder("run")
        .setLock("pessimistic_write")
        .where("run.id = :id", { id: evaluationExtractionRunId })
        .andWhere("run.organization_id = :organizationId", {
          organizationId: connectScope.organizationId,
        })
        .andWhere("run.project_id = :projectId", { projectId: connectScope.projectId })
        .getOne()

      if (!run || !run.summary) {
        throw new Error(`Run ${evaluationExtractionRunId} has no summary to update`)
      }

      const rows = await runRecordRepository
        .createQueryBuilder("record")
        .select("record.status", "status")
        .addSelect("COUNT(*)", "count")
        .where("record.evaluation_extraction_run_id = :runId", {
          runId: evaluationExtractionRunId,
        })
        .andWhere("record.organization_id = :organizationId", {
          organizationId: connectScope.organizationId,
        })
        .andWhere("record.project_id = :projectId", { projectId: connectScope.projectId })
        .groupBy("record.status")
        .getRawMany<{ status: EvaluationExtractionRunRecordStatus; count: string }>()

      const countByStatus = (status: EvaluationExtractionRunRecordStatus): number =>
        Number(rows.find((row) => row.status === status)?.count ?? 0)

      const summary: EvaluationExtractionRunSummary = {
        total: run.summary.total,
        perfectMatches: countByStatus("match"),
        mismatches: countByStatus("mismatch"),
        errors: countByStatus("error"),
        running: countByStatus("running"),
      }

      await runRepository.update({ id: evaluationExtractionRunId }, { summary })

      if (summary.errors > 0) {
        // Preserve existing behaviour: any error fails the whole run immediately, and a
        // failed run never produces a CSV export.
        await runRepository
          .createQueryBuilder()
          .update()
          .set({ status: "failed" })
          .where("id = :id", { id: evaluationExtractionRunId })
          .andWhere("status = :running", { running: "running" })
          .execute()
        return false
      }

      const isCompleted =
        summary.running === 0 && summary.perfectMatches + summary.mismatches === summary.total
      if (isCompleted) {
        const result = await runRepository
          .createQueryBuilder()
          .update()
          .set({ status: "completed" })
          .where("id = :id", { id: evaluationExtractionRunId })
          .andWhere("status = :running", { running: "running" })
          .execute()
        // Only the worker that actually transitioned the run owns the one-off CSV export.
        return result.affected === 1
      }

      return false
    })

    const updatedRun = await this.getEvaluationExtractionRun({
      id: evaluationExtractionRunId,
      connectScope,
    })
    // Generated outside the transaction so the run-row lock is not held during the
    // (potentially slow) export.
    if (shouldGenerateCsv) {
      await this.generateCsv(updatedRun)
    }
    await this.notifyStatusChanged(updatedRun)
  }

  async markRecordFailed(
    payload: ProcessEvaluationExtractionRunRecordJobPayload,
    error: Error,
  ): Promise<void> {
    const { connectScope, evaluationExtractionRun } = payload

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
    runRecord.comparison = null
    runRecord.agentRawOutput = null
    runRecord.traceId = null
    await this.runRecordConnectRepository.saveOne(runRecord)

    await this.recomputeSummaryAndMaybeComplete({
      connectScope,
      evaluationExtractionRunId: evaluationExtractionRun.id,
    })
  }

  private async getEvaluationExtractionRun({
    id,
    connectScope,
  }: {
    id: string
    connectScope: RequiredConnectScope
  }): Promise<EvaluationExtractionRun> {
    const run = await this.evaluationExtractionRunConnectRepository.getOneById(connectScope, id)
    if (!run) {
      throw new NotFoundException(`Evaluation run with id ${id} not found`)
    }
    return run
  }

  private async processOneRecord({
    runRecord,
    datasetRecord,
    schemaMapping,
    agent,
    evaluationExtractionRun,
    connectScope,
  }: {
    runRecord: EvaluationExtractionRunRecord
    datasetRecord: EvaluationExtractionDatasetRecord
    schemaMapping: EvaluationExtractionDatasetSchemaMapping
    agent: Agent
    evaluationExtractionRun: EvaluationExtractionRun
    connectScope: RequiredConnectScope
  }): Promise<void> {
    try {
      const inputText = this.buildInputText({
        datasetRecord,
        schemaMapping,
      })

      const { output: agentOutput, traceId } = await this.invokeAgent({
        agent,
        inputText,
        connectScope,
      })

      const gradeResult = this.graderService.gradeRecord({
        agentOutput,
        datasetRecordData: datasetRecord.data,
        keyMapping: evaluationExtractionRun.keyMapping,
      })

      runRecord.status = gradeResult.status
      runRecord.comparison = gradeResult.comparison
      runRecord.agentRawOutput = agentOutput
      runRecord.errorDetails = null
      runRecord.traceId = traceId
      await this.runRecordConnectRepository.saveOne(runRecord)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error during agent invocation"

      runRecord.status = "error"
      runRecord.comparison = null
      runRecord.agentRawOutput = null
      runRecord.errorDetails = errorMessage
      runRecord.traceId = null
      await this.runRecordConnectRepository.saveOne(runRecord)
    }

    await this.recomputeSummaryAndMaybeComplete({
      connectScope,
      evaluationExtractionRunId: evaluationExtractionRun.id,
    })
  }

  private async generateCsv(evaluationExtractionRun: EvaluationExtractionRun): Promise<void> {
    try {
      await this.csvExportService.generateAndStoreDocument(evaluationExtractionRun)
    } catch (error) {
      this.logger.error(
        `Failed to generate CSV export for run ${evaluationExtractionRun.id}: ${(error as Error).message}`,
        (error as Error).stack,
      )
    }
  }

  private async notifyStatusChanged(
    evaluationExtractionRun: EvaluationExtractionRun,
  ): Promise<void> {
    await this.statusNotifierService.notifyRunStatusChanged({
      evaluationExtractionRunId: evaluationExtractionRun.id,
      organizationId: evaluationExtractionRun.organizationId,
      projectId: evaluationExtractionRun.projectId,
      status: evaluationExtractionRun.status,
      summary: evaluationExtractionRun.summary,
      updatedAt: evaluationExtractionRun.updatedAt.getTime(),
    })
  }

  private buildInputText({
    datasetRecord,
    schemaMapping,
  }: {
    datasetRecord: EvaluationExtractionDatasetRecord
    schemaMapping: EvaluationExtractionDatasetSchemaMapping
  }): string {
    const inputColumns: DatasetSchemaColumn[] = Object.values(schemaMapping).filter(
      (column) => column.role === "input",
    )

    const lines: string[] = []
    for (const column of inputColumns) {
      const value = datasetRecord.data[column.id]
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
        "Agent must have an outputJsonSchema for evaluation runs",
      )
    }

    const traceId = v4()
    const llmMessage: LLMChatMessage = {
      role: "user",
      content: [{ type: "text", text: inputText }],
    }

    const systemPrompt = `${agent.defaultPrompt}\n\nToday's date: ${new Date().toLocaleDateString()}`

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
      tags: [agent.name, "evaluation-extraction-run"],
    }

    const output = await this.getProviderForModel(agent.model).generateStructuredOutput({
      message: llmMessage,
      schema: agent.outputJsonSchema,
      config: llmConfig,
      metadata: llmMetadata,
    })

    return { output, traceId }
  }
}
