import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: DataSource required at runtime for NestJS DI
import { DataSource, type Repository } from "typeorm"
import { v4 } from "uuid"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { LLMMetadata, LLMProvider } from "@/common/interfaces/llm-provider.interface"
import type { AgentWithSettingsRunJobPayload } from "@/domains/agents/shared/agent-with-settings-run.types"
import { ServiceWithLLM } from "@/external/llm"
import {
  EvaluationConversationRun,
  type EvaluationConversationRunSummary,
} from "./evaluation-conversation-run.entity"
import type { ProcessEvaluationConversationRunRecordJobPayload } from "./evaluation-conversation-run.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationRunGraderService } from "./evaluation-conversation-run-grader.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationRunStatusNotifierService } from "./evaluation-conversation-run-status-notifier.service"
import {
  EvaluationConversationRunRecord,
  type EvaluationConversationRunRecordStatus,
} from "./records/evaluation-conversation-run-record.entity"

@Injectable()
export class EvaluationConversationRunProcessorService extends ServiceWithLLM {
  private readonly logger = new Logger(EvaluationConversationRunProcessorService.name)
  private readonly evaluationConversationRunConnectRepository: ConnectRepository<EvaluationConversationRun>
  private readonly runRecordConnectRepository: ConnectRepository<EvaluationConversationRunRecord>

  constructor(
    @InjectRepository(EvaluationConversationRun)
    evaluationConversationRunRepository: Repository<EvaluationConversationRun>,
    @InjectRepository(EvaluationConversationRunRecord)
    evaluationConversationRunRecordRepository: Repository<EvaluationConversationRunRecord>,
    private readonly graderService: EvaluationConversationRunGraderService,
    private readonly statusNotifierService: EvaluationConversationRunStatusNotifierService,
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
    this.evaluationConversationRunConnectRepository = new ConnectRepository(
      evaluationConversationRunRepository,
      "evaluationConversationRun",
    )
    this.runRecordConnectRepository = new ConnectRepository(
      evaluationConversationRunRecordRepository,
      "evaluationConversationRunRecord",
    )
  }

  async processRunRecord(payload: ProcessEvaluationConversationRunRecordJobPayload): Promise<void> {
    const { connectScope, evaluationConversationRun, runRecordId, agentWithSettings } = payload

    const runRecord = await this.runRecordConnectRepository.getOneById(connectScope, runRecordId)
    if (!runRecord) {
      throw new NotFoundException(`Evaluation run record with id ${runRecordId} not found`)
    }

    if (runRecord.status === "graded") {
      this.logger.log(
        `Evaluation run record ${runRecordId} already processed (status=${runRecord.status}); skipping`,
      )
      return
    }

    if (
      evaluationConversationRun.status === "cancelled" ||
      evaluationConversationRun.status === "completed"
    ) {
      this.logger.log(
        `Evaluation run ${evaluationConversationRun.id} is ${evaluationConversationRun.status}; skipping record ${runRecordId}`,
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
      agentWithSettings,
      evaluationConversationRun,
      connectScope,
    })
  }

  /**
   * Recomputes the run summary from the run-record table and, when the run reaches a
   * terminal state, transitions its status.
   *
   * This is safe to call concurrently from multiple workers: a pessimistic lock on the
   * run row serializes summary updates per run, and the counts are derived from the
   * records table rather than mutated in place, so the result is idempotent even when a
   * record job is retried. Terminal transitions are guarded by `status = 'running'` so
   * they fire exactly once.
   */
  private async recomputeSummaryAndMaybeComplete({
    connectScope,
    evaluationConversationRunId,
  }: {
    connectScope: RequiredConnectScope
    evaluationConversationRunId: string
  }): Promise<void> {
    await this.dataSource.transaction(async (entityManager) => {
      const runRepository = entityManager.getRepository(EvaluationConversationRun)
      const runRecordRepository = entityManager.getRepository(EvaluationConversationRunRecord)

      // Serialize summary updates for this run across concurrent record jobs. The last
      // job to acquire the lock therefore observes every committed record status.
      const run = await runRepository
        .createQueryBuilder("run")
        .setLock("pessimistic_write")
        .where("run.id = :id", { id: evaluationConversationRunId })
        .andWhere("run.organization_id = :organizationId", {
          organizationId: connectScope.organizationId,
        })
        .andWhere("run.project_id = :projectId", { projectId: connectScope.projectId })
        .getOne()

      if (!run || !run.summary) {
        throw new Error(`Run ${evaluationConversationRunId} has no summary to update`)
      }

      const rows = await runRecordRepository
        .createQueryBuilder("record")
        .select("record.status", "status")
        .addSelect("COUNT(*)", "count")
        .addSelect("AVG(record.score) FILTER (WHERE record.status = 'graded')", "averageScore")
        .where("record.evaluation_conversation_run_id = :runId", {
          runId: evaluationConversationRunId,
        })
        .andWhere("record.organization_id = :organizationId", {
          organizationId: connectScope.organizationId,
        })
        .andWhere("record.project_id = :projectId", { projectId: connectScope.projectId })
        .groupBy("record.status")
        .getRawMany<{
          status: EvaluationConversationRunRecordStatus
          count: string
          averageScore: string | null
        }>()

      const countByStatus = (status: EvaluationConversationRunRecordStatus): number =>
        Number(rows.find((row) => row.status === status)?.count ?? 0)

      const rawAverageScore = rows.find((row) => row.status === "graded")?.averageScore ?? null
      // Scores are integers 0-5; keep one decimal on the average so it stays meaningful.
      const averageScore =
        rawAverageScore != null ? Math.round(Number(rawAverageScore) * 10) / 10 : null

      const summary: EvaluationConversationRunSummary = {
        total: run.summary.total,
        graded: countByStatus("graded"),
        errors: countByStatus("error"),
        running: countByStatus("running"),
        averageScore,
      }

      await runRepository.update({ id: evaluationConversationRunId }, { summary })

      if (summary.errors > 0) {
        // Preserve the extraction-run behaviour: any error fails the whole run immediately.
        await runRepository
          .createQueryBuilder()
          .update()
          .set({ status: "failed" })
          .where("id = :id", { id: evaluationConversationRunId })
          .andWhere("status = :running", { running: "running" })
          .execute()
        return
      }

      const isCompleted = summary.running === 0 && summary.graded === summary.total
      if (isCompleted) {
        await runRepository
          .createQueryBuilder()
          .update()
          .set({ status: "completed" })
          .where("id = :id", { id: evaluationConversationRunId })
          .andWhere("status = :running", { running: "running" })
          .execute()
      }
    })

    const updatedRun = await this.getEvaluationConversationRun({
      id: evaluationConversationRunId,
      connectScope,
    })
    await this.notifyStatusChanged(updatedRun)
  }

  async markRecordFailed(
    payload: ProcessEvaluationConversationRunRecordJobPayload,
    error: Error,
  ): Promise<void> {
    const { connectScope, evaluationConversationRun } = payload

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
    runRecord.output = null
    runRecord.score = null
    runRecord.traceId = null
    await this.runRecordConnectRepository.saveOne(runRecord)

    await this.recomputeSummaryAndMaybeComplete({
      connectScope,
      evaluationConversationRunId: evaluationConversationRun.id,
    })
  }

  private async getEvaluationConversationRun({
    id,
    connectScope,
  }: {
    id: string
    connectScope: RequiredConnectScope
  }): Promise<EvaluationConversationRun> {
    const run = await this.evaluationConversationRunConnectRepository.getOneById(connectScope, id)
    if (!run) {
      throw new NotFoundException(`Evaluation run with id ${id} not found`)
    }
    return run
  }

  private async processOneRecord({
    runRecord,
    agentWithSettings,
    evaluationConversationRun,
    connectScope,
  }: {
    runRecord: EvaluationConversationRunRecord
    agentWithSettings: AgentWithSettingsRunJobPayload
    evaluationConversationRun: EvaluationConversationRun
    connectScope: RequiredConnectScope
  }): Promise<void> {
    try {
      const { output, traceId } = await this.invokeAgent({
        agentWithSettings,
        inputText: runRecord.input,
        connectScope,
      })

      const score = await this.graderService.gradeOutput({
        expectedOutput: runRecord.expectedOutput,
        generatedOutput: output,
        generatorModel: agentWithSettings.model,
        traceId,
        connectScope,
      })

      runRecord.status = "graded"
      runRecord.output = output
      runRecord.score = score
      runRecord.errorDetails = null
      runRecord.traceId = traceId
      await this.runRecordConnectRepository.saveOne(runRecord)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error during agent invocation"

      runRecord.status = "error"
      runRecord.output = null
      runRecord.score = null
      runRecord.errorDetails = errorMessage
      runRecord.traceId = null
      await this.runRecordConnectRepository.saveOne(runRecord)
    }

    await this.recomputeSummaryAndMaybeComplete({
      connectScope,
      evaluationConversationRunId: evaluationConversationRun.id,
    })
  }

  private async notifyStatusChanged(
    evaluationConversationRun: EvaluationConversationRun,
  ): Promise<void> {
    await this.statusNotifierService.notifyRunStatusChanged({
      evaluationConversationRunId: evaluationConversationRun.id,
      organizationId: evaluationConversationRun.organizationId,
      projectId: evaluationConversationRun.projectId,
      status: evaluationConversationRun.status,
      summary: evaluationConversationRun.summary,
      updatedAt: evaluationConversationRun.updatedAt.getTime(),
    })
  }

  private async invokeAgent({
    agentWithSettings,
    inputText,
    connectScope,
  }: {
    agentWithSettings: AgentWithSettingsRunJobPayload
    inputText: string
    connectScope: RequiredConnectScope
  }): Promise<{ output: string; traceId: string }> {
    const traceId = v4()

    const llmConfig = this.buildLLMConfig({
      systemPrompt: this.generateMasterPrompt(agentWithSettings),
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
        `rev-${agentWithSettings.revision}`,
        agentWithSettings.type,
        "evaluation-conversation-run",
      ],
    }

    const output = await this.getProviderForModel(agentWithSettings.model).generateText({
      prompt: inputText,
      config: llmConfig,
      metadata: llmMetadata,
    })

    return { output, traceId }
  }

  /**
   * Ported from the legacy EvaluationReportsService.generateMasterPrompt so results stay
   * comparable with the legacy studio evaluation reports. The volatile date stays at the
   * end of the prompt for provider prompt caching.
   */
  private generateMasterPrompt(agentWithSettings: AgentWithSettingsRunJobPayload): string {
    return `${agentWithSettings.instructions}

# Attachment:
If there is a file (image or pdf) attached to the user's chat message, answer the user's question or instruction reading the content of the file.

Always answer in ${agentWithSettings.locale}.

Today's date: ${new Date().toLocaleDateString()}`
  }
}
