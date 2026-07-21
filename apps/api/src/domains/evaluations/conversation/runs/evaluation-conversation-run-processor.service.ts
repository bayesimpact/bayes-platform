import { Injectable, Logger, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: DataSource required at runtime for NestJS DI
import { DataSource, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentLlmRequestService } from "@/domains/agents/shared/agent-session-messages/streaming/agent-llm-request.service"
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
export class EvaluationConversationRunProcessorService {
  private readonly logger = new Logger(EvaluationConversationRunProcessorService.name)
  private readonly evaluationConversationRunConnectRepository: ConnectRepository<EvaluationConversationRun>
  private readonly runRecordConnectRepository: ConnectRepository<EvaluationConversationRunRecord>
  private readonly agentConnectRepository: ConnectRepository<Agent>
  private readonly agentSettingsConnectRepository: ConnectRepository<AgentSettings>

  constructor(
    @InjectRepository(EvaluationConversationRun)
    evaluationConversationRunRepository: Repository<EvaluationConversationRun>,
    @InjectRepository(EvaluationConversationRunRecord)
    evaluationConversationRunRecordRepository: Repository<EvaluationConversationRunRecord>,
    @InjectRepository(Agent)
    agentRepository: Repository<Agent>,
    @InjectRepository(AgentSettings)
    agentSettingsRepository: Repository<AgentSettings>,
    private readonly agentLlmRequestService: AgentLlmRequestService,
    private readonly graderService: EvaluationConversationRunGraderService,
    private readonly statusNotifierService: EvaluationConversationRunStatusNotifierService,
    private readonly dataSource: DataSource,
  ) {
    this.evaluationConversationRunConnectRepository = new ConnectRepository(
      evaluationConversationRunRepository,
      "evaluationConversationRun",
    )
    this.runRecordConnectRepository = new ConnectRepository(
      evaluationConversationRunRecordRepository,
      "evaluationConversationRunRecord",
    )
    this.agentConnectRepository = new ConnectRepository(agentRepository, "agent")
    this.agentSettingsConnectRepository = new ConnectRepository(
      agentSettingsRepository,
      "agentSettings",
    )
  }

  async processRunRecord(payload: ProcessEvaluationConversationRunRecordJobPayload): Promise<void> {
    const { connectScope, evaluationConversationRun, runRecordId } = payload

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
    evaluationConversationRun,
    connectScope,
  }: {
    runRecord: EvaluationConversationRunRecord
    evaluationConversationRun: EvaluationConversationRun
    connectScope: RequiredConnectScope
  }): Promise<void> {
    try {
      const { agent, agentSettings } = await this.loadAgentWithSettings({
        evaluationConversationRun,
        connectScope,
      })

      // Run the agent through the exact same request building as Studio
      // (tools, master prompt, streaming provider call), so the evaluation
      // measures the agent as users actually experience it.
      const { output, traceId } = await this.agentLlmRequestService.runSingleTurn({
        agent,
        agentSettings,
        connectScope,
        userContent: runRecord.input,
        extraTags: ["evaluation-conversation-run"],
      })

      const score = await this.graderService.gradeOutput({
        expectedOutput: runRecord.expectedOutput,
        generatedOutput: output,
        generatorModel: agentSettings.model,
        judgeModel: evaluationConversationRun.judgeModel,
        judgeInstructions: evaluationConversationRun.judgeInstructions,
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

  /**
   * Loads the evaluated agent with the same relations as Studio's
   * AgentContextResolver, so tools and the master prompt build identically.
   */
  private async loadAgentWithSettings({
    evaluationConversationRun,
    connectScope,
  }: {
    evaluationConversationRun: EvaluationConversationRun
    connectScope: RequiredConnectScope
  }): Promise<{ agent: Agent; agentSettings: AgentSettings }> {
    const agent = await this.agentConnectRepository.getOneById(
      connectScope,
      evaluationConversationRun.agentId,
      { relations: ["documentTags", "sessionCategories", "resourceLibraries"] },
    )
    if (!agent) {
      throw new NotFoundException(`Agent with id ${evaluationConversationRun.agentId} not found`)
    }

    const agentSettings = await this.agentSettingsConnectRepository.getOneById(
      connectScope,
      evaluationConversationRun.agentSettingsId,
    )
    if (!agentSettings) {
      throw new NotFoundException(
        `AgentSettings with id ${evaluationConversationRun.agentSettingsId} not found`,
      )
    }

    return { agent, agentSettings }
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
}
