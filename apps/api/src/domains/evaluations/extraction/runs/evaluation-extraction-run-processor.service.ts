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
import type {
  DatasetSchemaColumn,
  EvaluationExtractionDatasetSchemaMapping,
} from "../datasets/evaluation-extraction-dataset.entity"
import type { EvaluationExtractionDatasetRecord } from "../datasets/records/evaluation-extraction-dataset-record.entity"
import { EvaluationExtractionRun } from "./evaluation-extraction-run.entity"
import type { ProcessEvaluationExtractionRunRecordJobPayload } from "./evaluation-extraction-run.types"
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
    @Inject("MedGemmaLLMProvider")
    medGemmaLlmProvider: LLMProvider,
    @Inject("GemmaLLMProvider")
    gemmaLlmProvider: LLMProvider,
  ) {
    super({ mockLlmProvider, vertexLlmProvider, medGemmaLlmProvider, gemmaLlmProvider })
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

    await this.processOneRecord({
      runRecord,
      datasetRecord: runRecord.evaluationExtractionDatasetRecord,
      schemaMapping: payload.schemaMapping,
      agent,
      evaluationExtractionRun,
      connectScope,
    })
  }

  private async incrementSummary({
    connectScope,
    evaluationExtractionRunId,
    runRecord,
  }: {
    connectScope: RequiredConnectScope
    evaluationExtractionRunId: string
    runRecord: EvaluationExtractionRunRecord
  }): Promise<void> {
    const run = await this.getEvaluationExtractionRun({
      id: evaluationExtractionRunId,
      connectScope,
    })
    const summary = run.summary
    if (!summary) {
      throw new Error(`Run ${evaluationExtractionRunId} has no summary to increment`)
    }

    const stopRunning = () => {
      summary.running -= 1
    }

    switch (runRecord.status) {
      case "match":
        summary.perfectMatches += 1
        stopRunning()
        break
      case "mismatch":
        summary.mismatches += 1
        stopRunning()
        break
      case "error":
        summary.errors += 1
        stopRunning()
        break
      case "running":
        summary.running += 1
        break
    }

    async function updateRunStatus({
      status,
      evaluationExtractionRunConnectRepository,
    }: {
      status: EvaluationExtractionRun["status"]
      evaluationExtractionRunConnectRepository: ConnectRepository<EvaluationExtractionRun>
    }) {
      await evaluationExtractionRunConnectRepository.updateOneById({
        connectScope,
        id: evaluationExtractionRunId,
        fields: { status },
      })
    }

    await this.evaluationExtractionRunConnectRepository.updateOneById({
      connectScope,
      id: evaluationExtractionRunId,
      fields: { summary },
    })

    if (summary.errors > 0) {
      await updateRunStatus({
        status: "failed",
        evaluationExtractionRunConnectRepository: this.evaluationExtractionRunConnectRepository,
      })
    }

    const isCompleted =
      summary.running === 0 && summary.mismatches + summary.perfectMatches === summary.total
    if (isCompleted) {
      await updateRunStatus({
        status: "completed",
        evaluationExtractionRunConnectRepository: this.evaluationExtractionRunConnectRepository,
      })

      await this.generateCsv(run)
    }

    const updatedRun = await this.getEvaluationExtractionRun({
      id: evaluationExtractionRunId,
      connectScope,
    })
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

    await this.incrementSummary({
      connectScope,
      evaluationExtractionRunId: evaluationExtractionRun.id,
      runRecord,
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

    await this.incrementSummary({
      connectScope,
      evaluationExtractionRunId: evaluationExtractionRun.id,
      runRecord,
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
