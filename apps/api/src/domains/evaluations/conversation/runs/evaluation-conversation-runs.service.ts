import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { toAgentWithSettingsRunJobPayload } from "@/domains/agents/shared/agent-with-settings-run.helper"
import { EvaluationConversationDataset } from "../datasets/evaluation-conversation-dataset.entity"
import {
  EvaluationConversationRun,
  type EvaluationConversationRunSummary,
} from "./evaluation-conversation-run.entity"
import { batchArray } from "./evaluation-conversation-run.helpers"
import {
  EVALUATION_CONVERSATION_RUN_BATCH_SERVICE,
  type EvaluationConversationRunBatchService,
} from "./evaluation-conversation-run-batch.interface"
import { EvaluationConversationRunRecord } from "./records/evaluation-conversation-run-record.entity"

const BATCH_SIZE = 500

@Injectable()
export class EvaluationConversationRunsService {
  private readonly runConnectRepository: ConnectRepository<EvaluationConversationRun>
  private readonly runRecordConnectRepository: ConnectRepository<EvaluationConversationRunRecord>
  private readonly datasetConnectRepository: ConnectRepository<EvaluationConversationDataset>
  private readonly agentConnectRepository: ConnectRepository<Agent>

  constructor(
    @InjectRepository(EvaluationConversationRun)
    evaluationConversationRunRepository: Repository<EvaluationConversationRun>,
    @InjectRepository(EvaluationConversationRunRecord)
    evaluationConversationRunRecordRepository: Repository<EvaluationConversationRunRecord>,
    @InjectRepository(EvaluationConversationDataset)
    evaluationConversationDatasetRepository: Repository<EvaluationConversationDataset>,
    @InjectRepository(Agent)
    agentRepository: Repository<Agent>,
    @InjectRepository(AgentSettings)
    private readonly agentSettingsRepository: Repository<AgentSettings>,
    @Inject(EVALUATION_CONVERSATION_RUN_BATCH_SERVICE)
    private readonly batchService: EvaluationConversationRunBatchService,
  ) {
    this.runConnectRepository = new ConnectRepository(
      evaluationConversationRunRepository,
      "evaluationConversationRun",
    )
    this.runRecordConnectRepository = new ConnectRepository(
      evaluationConversationRunRecordRepository,
      "evaluationConversationRunRecord",
    )
    this.datasetConnectRepository = new ConnectRepository(
      evaluationConversationDatasetRepository,
      "evaluationConversationDataset",
    )
    this.agentConnectRepository = new ConnectRepository(agentRepository, "agent")
  }

  async createRun({
    connectScope,
    fields,
  }: {
    connectScope: RequiredConnectScope
    fields: {
      evaluationConversationDatasetId: string
      agentId: string
      agentSettingsId: string
    }
  }): Promise<EvaluationConversationRun> {
    // Ensure dataset exists and belongs to the same project/organization before creating run to avoid orphaned runs and to validate access upfront
    await this.getDataset({ id: fields.evaluationConversationDatasetId, connectScope })

    const agent = await this.agentConnectRepository.getOneById(connectScope, fields.agentId)
    if (!agent) {
      throw new NotFoundException(`Agent with id ${fields.agentId} not found`)
    }

    if (agent.type !== "conversation") {
      throw new UnprocessableEntityException(
        "Only conversation agents can be used for evaluation runs",
      )
    }

    return this.runConnectRepository.createAndSave(connectScope, {
      evaluationConversationDatasetId: fields.evaluationConversationDatasetId,
      agentId: fields.agentId,
      agentSettingsId: fields.agentSettingsId,
      status: "pending",
      summary: null,
    })
  }

  async getDataset({
    id,
    connectScope,
  }: {
    id: string
    connectScope: RequiredConnectScope
  }): Promise<EvaluationConversationDataset> {
    const dataset = await this.datasetConnectRepository.getOneById(connectScope, id)
    if (!dataset) {
      throw new NotFoundException(`Evaluation dataset with id ${id} not found`)
    }

    return dataset
  }

  async getRun({
    connectScope,
    runId,
  }: {
    connectScope: RequiredConnectScope
    runId: string
  }): Promise<EvaluationConversationRun | null> {
    return this.runConnectRepository.getOneById(connectScope, runId)
  }

  async markRunCancelled({
    evaluationConversationRun,
    connectScope,
  }: {
    connectScope: RequiredConnectScope
    evaluationConversationRun: EvaluationConversationRun
  }): Promise<EvaluationConversationRun> {
    if (
      // Only allow cancelling runs that are currently pending or running. Completed, failed or cancelled runs cannot be cancelled (again)
      ["pending", "running"].indexOf(evaluationConversationRun.status) === -1
    ) {
      throw new UnprocessableEntityException(
        `Evaluation run is in status "${evaluationConversationRun.status}" and cannot be cancelled`,
      )
    }

    evaluationConversationRun.status = "cancelled"

    await this.runRecordConnectRepository.updateManyBy({
      connectScope,
      where: { evaluationConversationRunId: evaluationConversationRun.id, status: "running" },
      fields: { status: "cancelled" },
    })

    return this.runConnectRepository.saveOne(evaluationConversationRun)
  }

  async listRuns({
    connectScope,
  }: {
    connectScope: RequiredConnectScope
  }): Promise<EvaluationConversationRun[]> {
    const runs = await this.runConnectRepository.find(connectScope, {
      order: { createdAt: "DESC" },
    })
    return runs
  }

  async getRunRecordsPaginated({
    connectScope,
    runId,
    page,
    limit,
  }: {
    connectScope: RequiredConnectScope
    runId: string
    page: number
    limit: number
  }): Promise<{ records: EvaluationConversationRunRecord[]; total: number }> {
    const alias = "evaluationConversationRunRecord"

    const query = this.runRecordConnectRepository
      .newQueryBuilderWithConnectScope(connectScope)
      .andWhere(`${alias}.evaluation_conversation_run_id = :runId`, { runId })
      .orderBy(`${alias}.createdAt`, "ASC")
      .skip(page * limit)
      .take(limit)

    const [records, total] = await query.getManyAndCount()

    return { records, total }
  }

  async enqueueExecuteRun({
    evaluationConversationRun,
    connectScope,
    recordLimit,
  }: {
    evaluationConversationRun: EvaluationConversationRun
    connectScope: RequiredConnectScope
    recordLimit?: number | null
  }): Promise<void> {
    await this.batchService.enqueueExecuteRun({
      evaluationConversationRunId: evaluationConversationRun.id,
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
      recordLimit: recordLimit ?? null,
    })
  }

  private async getAgent({
    connectScope,
    agentId,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
  }): Promise<{ agent: Agent; agentSettings: AgentSettings }> {
    const agent = await this.agentConnectRepository.getOneById(connectScope, agentId)
    if (!agent) {
      throw new NotFoundException(`Agent with id ${agentId} not found`)
    }
    const agentSettings = await this.agentSettingsRepository.findOne({
      where: { agentId },
      order: { revision: "DESC" }, //findOne + order DESC to get last revision
    })
    if (!agentSettings)
      throw new NotFoundException(`AgentSettings for Agent with id ${agentId} not found`)

    return { agent, agentSettings }
  }

  async retryRun({
    evaluationConversationRun,
    connectScope,
  }: {
    evaluationConversationRun: EvaluationConversationRun
    connectScope: RequiredConnectScope
  }): Promise<void> {
    const allRunRecords = await this.runRecordConnectRepository.find(connectScope, {
      where: { evaluationConversationRunId: evaluationConversationRun.id },
    })
    const retryableRecords = allRunRecords.filter(
      (runRecord) => runRecord.status === "error" || runRecord.status === "cancelled",
    )

    // Nothing to retry: keep the run untouched instead of flipping it to a
    // "running" state that no worker would ever complete.
    if (retryableRecords.length === 0) return

    const { agent, agentSettings } = await this.getAgent({
      connectScope,
      agentId: evaluationConversationRun.agentId,
    })

    // Reset the retried records so the processor's status === "running" guard
    // lets them through, clearing the stale results of the previous attempt.
    await this.runRecordConnectRepository.updateManyBy({
      connectScope,
      where: { id: In(retryableRecords.map((runRecord) => runRecord.id)) },
      fields: { status: "running", output: null, score: null, errorDetails: null, traceId: null },
    })

    // Recompute the summary from the post-reset record statuses: retried records
    // are running again and no error/cancelled records remain.
    const gradedRecords = allRunRecords.filter((runRecord) => runRecord.status === "graded")
    const runningCount =
      allRunRecords.filter((runRecord) => runRecord.status === "running").length +
      retryableRecords.length
    const averageScore =
      gradedRecords.length > 0
        ? Math.round(
            gradedRecords.reduce((sum, runRecord) => sum + (runRecord.score ?? 0), 0) /
              gradedRecords.length,
          )
        : null
    const summary: EvaluationConversationRunSummary = {
      total: allRunRecords.length,
      graded: gradedRecords.length,
      errors: 0,
      running: runningCount,
      averageScore,
    }

    evaluationConversationRun.summary = summary
    evaluationConversationRun.status = "running"
    await this.runConnectRepository.saveOne(evaluationConversationRun)

    const batches = batchArray(retryableRecords, BATCH_SIZE)

    try {
      await Promise.all(
        batches.map(
          async (batch) =>
            await this.batchService.retryRunRecords(
              batch.map((runRecord) => ({
                agentWithSettings: toAgentWithSettingsRunJobPayload({ agent, agentSettings }),
                connectScope,
                evaluationConversationRun,
                runRecordId: runRecord.id,
              })),
            ),
        ),
      )
    } catch (error) {
      // If retrying fails, mark the run as failed to avoid leaving it in a limbo state
      evaluationConversationRun.status = "failed"
      await this.runConnectRepository.saveOne(evaluationConversationRun)

      throw new UnprocessableEntityException(
        `Failed to retry jobs for the evaluation run ${evaluationConversationRun.id}. Error: ${error instanceof Error ? error.message : "No error message"}`,
      )
    }
  }

  async removePendingJobsForRun({
    evaluationConversationRunId,
    connectScope,
  }: {
    evaluationConversationRunId: string
    connectScope: RequiredConnectScope
  }): Promise<void> {
    const unfinishedRecords = await this.runRecordConnectRepository.find(connectScope, {
      where: { evaluationConversationRunId, status: "running" },
    })

    const batches = batchArray(unfinishedRecords, BATCH_SIZE)

    try {
      await Promise.all(
        batches.map(
          async (batch) =>
            await this.batchService.removePendingRunRecords(batch.map((runRecord) => runRecord.id)),
        ),
      )
    } catch (error) {
      throw new UnprocessableEntityException(
        `Failed to remove pending jobs for the run ${evaluationConversationRunId}. Error: ${error instanceof Error ? error.message : "No error message"}`,
      )
    }
  }

  async deleteRun({
    connectScope,
    evaluationConversationRunId,
  }: {
    connectScope: RequiredConnectScope
    evaluationConversationRunId: string
  }): Promise<void> {
    try {
      await this.removePendingJobsForRun({ connectScope, evaluationConversationRunId })
    } catch {
      // Best-effort: proceed with delete even if job cleanup fails
    }

    await this.runRecordConnectRepository.deleteManyBy({
      connectScope,
      where: { evaluationConversationRunId },
      softDelete: false,
    })

    const isDeleted = await this.runConnectRepository.deleteOneById({
      connectScope,
      id: evaluationConversationRunId,
      softDelete: false,
    })

    if (!isDeleted) {
      throw new NotFoundException(
        `Evaluation conversation run with id ${evaluationConversationRunId} not found`,
      )
    }
  }
}
