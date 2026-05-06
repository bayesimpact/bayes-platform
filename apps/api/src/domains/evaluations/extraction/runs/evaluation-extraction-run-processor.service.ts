import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
import { v4 } from "uuid"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type {
  LLMChatMessage,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import { Agent } from "@/domains/agents/agent.entity"
import { ServiceWithLLM } from "@/external/llm"
import {
  type DatasetSchemaColumn,
  EvaluationExtractionDataset,
} from "../datasets/evaluation-extraction-dataset.entity"
import { EvaluationExtractionDatasetRecord } from "../datasets/records/evaluation-extraction-dataset-record.entity"
import {
  EvaluationExtractionRun,
  type EvaluationExtractionRunSummary,
} from "./evaluation-extraction-run.entity"
import type { ExecuteEvaluationExtractionRunJobPayload } from "./evaluation-extraction-run.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunCsvExportService } from "./evaluation-extraction-run-csv-export.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunGraderService } from "./evaluation-extraction-run-grader.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunStatusNotifierService } from "./evaluation-extraction-run-status-notifier.service"
import { EvaluationExtractionRunRecord } from "./records/evaluation-extraction-run-record.entity"

@Injectable()
export class EvaluationExtractionRunProcessorService extends ServiceWithLLM {
  private readonly logger = new Logger(EvaluationExtractionRunProcessorService.name)
  private readonly runConnectRepository: ConnectRepository<EvaluationExtractionRun>
  private readonly runRepository: Repository<EvaluationExtractionRun>
  private readonly runRecordConnectRepository: ConnectRepository<EvaluationExtractionRunRecord>
  private readonly datasetConnectRepository: ConnectRepository<EvaluationExtractionDataset>
  private readonly datasetRecordConnectRepository: ConnectRepository<EvaluationExtractionDatasetRecord>
  private readonly agentConnectRepository: ConnectRepository<Agent>

  constructor(
    @InjectRepository(EvaluationExtractionRun)
    evaluationExtractionRunRepository: Repository<EvaluationExtractionRun>,
    @InjectRepository(EvaluationExtractionRunRecord)
    evaluationExtractionRunRecordRepository: Repository<EvaluationExtractionRunRecord>,
    @InjectRepository(EvaluationExtractionDataset)
    evaluationExtractionDatasetRepository: Repository<EvaluationExtractionDataset>,
    @InjectRepository(EvaluationExtractionDatasetRecord)
    evaluationExtractionDatasetRecordRepository: Repository<EvaluationExtractionDatasetRecord>,
    @InjectRepository(Agent)
    agentRepository: Repository<Agent>,
    private readonly graderService: EvaluationExtractionRunGraderService,
    private readonly statusNotifierService: EvaluationExtractionRunStatusNotifierService,
    private readonly csvExportService: EvaluationExtractionRunCsvExportService,
    @Inject("_MockLLMProvider")
    mockLlmProvider: LLMProvider,
    @Inject("VertexLLMProvider")
    vertexLlmProvider: LLMProvider,
    @Inject("MedGemmaLLMProvider")
    medGemmaLlmProvider: LLMProvider,
  ) {
    super({ mockLlmProvider, vertexLlmProvider, medGemmaLlmProvider })
    this.runRepository = evaluationExtractionRunRepository
    this.runConnectRepository = new ConnectRepository(
      evaluationExtractionRunRepository,
      "evaluationExtractionRun",
    )
    this.runRecordConnectRepository = new ConnectRepository(
      evaluationExtractionRunRecordRepository,
      "evaluationExtractionRunRecord",
    )
    this.datasetConnectRepository = new ConnectRepository(
      evaluationExtractionDatasetRepository,
      "evaluationExtractionDataset",
    )
    this.datasetRecordConnectRepository = new ConnectRepository(
      evaluationExtractionDatasetRecordRepository,
      "evaluationExtractionDatasetRecord",
    )
    this.agentConnectRepository = new ConnectRepository(agentRepository, "agent")
  }

  async processRun(payload: ExecuteEvaluationExtractionRunJobPayload): Promise<void> {
    const connectScope: RequiredConnectScope = {
      organizationId: payload.organizationId,
      projectId: payload.projectId,
    }

    const run = await this.runConnectRepository.getOneById(connectScope, payload.runId)
    if (!run) {
      throw new NotFoundException(`Evaluation run with id ${payload.runId} not found`)
    }

    if (run.status === "completed") {
      throw new UnprocessableEntityException(
        `Evaluation run has already completed and cannot be re-executed.`,
      )
    }

    if (run.status === "cancelled") {
      throw new UnprocessableEntityException(
        `Evaluation run has been cancelled and cannot be re-executed.`,
      )
    }

    if (run.status === "running" || run.status === "failed") {
      this.logger.warn(
        `Evaluation run ${run.id} is being retried (previous status: "${run.status}").`,
      )
    }

    run.status = "running"
    run.summary = null
    await this.runConnectRepository.saveOne(run)
    await this.notifyStatusChanged(run)

    try {
      await this.executeAllRecords({ run, connectScope })
    } catch (error) {
      run.status = "failed"
      await this.runConnectRepository.saveOne(run)
      await this.notifyStatusChanged(run)
      throw error
    }
  }

  private async executeAllRecords({
    run,
    connectScope,
  }: {
    run: EvaluationExtractionRun
    connectScope: RequiredConnectScope
  }): Promise<void> {
    const { dataset, datasetRecords, agent, existingRunRecords } = await this.loadExecutionContext({
      run,
      connectScope,
    })

    const summary = createInitialSummary({
      recordCount: datasetRecords.length,
      existingRunRecords,
    })
    await this.initializeSummary({ run, summary })

    const processedDatasetRecordIds = new Set(
      existingRunRecords.map((record) => record.evaluationExtractionDatasetRecordId),
    )

    for (const datasetRecord of datasetRecords) {
      const cancelled = await this.loadRunIfCancelled({ runId: run.id, connectScope })
      if (cancelled) {
        await this.finalizeCancelledRun({ run: cancelled, summary })
        return
      }

      if (processedDatasetRecordIds.has(datasetRecord.id)) {
        continue
      }

      await this.processOneRecord({
        datasetRecord,
        dataset,
        agent,
        run,
        connectScope,
        summary,
      })

      await this.persistSummaryProgress({ runId: run.id, summary, connectScope })
    }

    await this.markCompleted({ run, summary })
    this.logger.log(`Evaluation run ${run.id} completed`)
  }

  private async loadExecutionContext({
    run,
    connectScope,
  }: {
    run: EvaluationExtractionRun
    connectScope: RequiredConnectScope
  }): Promise<{
    dataset: EvaluationExtractionDataset
    datasetRecords: EvaluationExtractionDatasetRecord[]
    agent: Agent
    existingRunRecords: EvaluationExtractionRunRecord[]
  }> {
    const dataset = await this.datasetConnectRepository.getOneById(
      connectScope,
      run.evaluationExtractionDatasetId,
    )
    if (!dataset) {
      throw new NotFoundException(
        `Evaluation dataset with id ${run.evaluationExtractionDatasetId} not found`,
      )
    }

    const datasetRecords = await this.datasetRecordConnectRepository.find(connectScope, {
      where: { evaluationExtractionDatasetId: dataset.id },
    })

    const agent = await this.agentConnectRepository.getOneById(connectScope, run.agentId)
    if (!agent) {
      throw new NotFoundException(`Agent with id ${run.agentId} not found`)
    }

    const existingRunRecords = await this.runRecordConnectRepository.find(connectScope, {
      where: { evaluationExtractionRunId: run.id, status: In(["match", "mismatch"]) },
    })

    return { dataset, datasetRecords, agent, existingRunRecords }
  }

  private async initializeSummary({
    run,
    summary,
  }: {
    run: EvaluationExtractionRun
    summary: EvaluationExtractionRunSummary
  }): Promise<void> {
    run.summary = summary
    await this.runConnectRepository.saveOne(run)
    await this.notifyStatusChanged(run)
  }

  private async processOneRecord({
    datasetRecord,
    dataset,
    agent,
    run,
    connectScope,
    summary,
  }: {
    datasetRecord: EvaluationExtractionDatasetRecord
    dataset: EvaluationExtractionDataset
    agent: Agent
    run: EvaluationExtractionRun
    connectScope: RequiredConnectScope
    summary: EvaluationExtractionRunSummary
  }): Promise<void> {
    try {
      const inputText = this.buildInputText({
        datasetRecord,
        schemaMapping: dataset.schemaMapping,
      })

      const { output: agentOutput, traceId } = await this.invokeAgent({
        agent,
        inputText,
        connectScope,
      })

      const gradeResult = this.graderService.gradeRecord({
        agentOutput,
        datasetRecordData: datasetRecord.data,
        keyMapping: run.keyMapping,
      })

      await this.runRecordConnectRepository.createAndSave(connectScope, {
        evaluationExtractionRunId: run.id,
        evaluationExtractionDatasetRecordId: datasetRecord.id,
        status: gradeResult.status,
        comparison: gradeResult.comparison,
        agentRawOutput: agentOutput,
        errorDetails: null,
        traceId,
      })

      summary.running--
      if (gradeResult.status === "match") {
        summary.perfectMatches++
      } else {
        summary.mismatches++
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error during agent invocation"

      await this.runRecordConnectRepository.createAndSave(connectScope, {
        evaluationExtractionRunId: run.id,
        evaluationExtractionDatasetRecordId: datasetRecord.id,
        status: "error",
        comparison: null,
        agentRawOutput: null,
        errorDetails: errorMessage,
      })

      summary.running--
      summary.errors++
    }
  }

  /**
   * Persists progress after a record completes. Uses a targeted summary-only update
   * (not saveOne) so a concurrent cancel, which writes status="cancelled", isn't
   * clobbered by a stale in-memory status="running". Reloads the run before notifying
   * so the SSE event carries the authoritative status.
   */
  private async persistSummaryProgress({
    runId,
    summary,
    connectScope,
  }: {
    runId: string
    summary: EvaluationExtractionRunSummary
    connectScope: RequiredConnectScope
  }): Promise<void> {
    await this.runRepository.update({ id: runId }, { summary })
    const latest = await this.runConnectRepository.getOneById(connectScope, runId)
    if (latest) await this.notifyStatusChanged(latest)
  }

  private async loadRunIfCancelled({
    runId,
    connectScope,
  }: {
    runId: string
    connectScope: RequiredConnectScope
  }): Promise<EvaluationExtractionRun | null> {
    const latest = await this.runConnectRepository.getOneById(connectScope, runId)
    return latest?.status === "cancelled" ? latest : null
  }

  private async finalizeCancelledRun({
    run,
    summary,
  }: {
    run: EvaluationExtractionRun
    summary: EvaluationExtractionRunSummary
  }): Promise<void> {
    this.logger.log(`Evaluation run ${run.id} cancelled — stopping processing`)
    run.summary = summary
    await this.runConnectRepository.saveOne(run)
    await this.notifyStatusChanged(run)
  }

  private async markCompleted({
    run,
    summary,
  }: {
    run: EvaluationExtractionRun
    summary: EvaluationExtractionRunSummary
  }): Promise<void> {
    run.status = "completed"
    run.summary = summary
    await this.runConnectRepository.saveOne(run)
    await this.generateCsv(run)
    await this.notifyStatusChanged(run)
  }

  async markFailed(payload: ExecuteEvaluationExtractionRunJobPayload): Promise<void> {
    const connectScope: RequiredConnectScope = {
      organizationId: payload.organizationId,
      projectId: payload.projectId,
    }

    const run = await this.runConnectRepository.getOneById(connectScope, payload.runId)
    if (!run) {
      throw new NotFoundException(`Evaluation run with id ${payload.runId} not found`)
    }

    run.status = "failed"
    await this.runConnectRepository.saveOne(run)
    await this.notifyStatusChanged(run)
  }

  private async generateCsv(run: EvaluationExtractionRun): Promise<void> {
    try {
      await this.csvExportService.generateAndStoreDocument(run)
    } catch (error) {
      this.logger.error(
        `Failed to generate CSV export for run ${run.id}: ${(error as Error).message}`,
        (error as Error).stack,
      )
    }
  }

  private async notifyStatusChanged(run: EvaluationExtractionRun): Promise<void> {
    await this.statusNotifierService.notifyRunStatusChanged({
      evaluationExtractionRunId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      status: run.status,
      summary: run.summary,
      updatedAt: run.updatedAt.getTime(),
    })
  }

  private buildInputText({
    datasetRecord,
    schemaMapping,
  }: {
    datasetRecord: EvaluationExtractionDatasetRecord
    schemaMapping: EvaluationExtractionDataset["schemaMapping"]
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

function createInitialSummary({
  recordCount,
  existingRunRecords,
}: {
  recordCount: number
  existingRunRecords: EvaluationExtractionRunRecord[]
}): EvaluationExtractionRunSummary {
  let perfectMatches = 0
  let mismatches = 0
  let errors = 0
  for (const record of existingRunRecords) {
    if (record.status === "match") perfectMatches++
    else if (record.status === "mismatch") mismatches++
    else if (record.status === "error") errors++
  }
  return {
    total: recordCount,
    perfectMatches,
    mismatches,
    errors,
    running: recordCount - existingRunRecords.length,
  }
}
