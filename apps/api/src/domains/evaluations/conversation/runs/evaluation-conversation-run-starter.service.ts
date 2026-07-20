import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Queue } from "bullmq"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { toAgentWithSettingsRunJobPayload } from "@/domains/agents/shared/agent-with-settings-run.helper"
import { EvaluationConversationDataset } from "../datasets/evaluation-conversation-dataset.entity"
import { EvaluationConversationDatasetRecord } from "../datasets/records/evaluation-conversation-dataset-record.entity"
import {
  EVALUATION_CONVERSATION_RUN_QUEUE_NAME,
  EVALUATION_CONVERSATION_RUN_RECORD_JOB_NAME,
} from "./evaluation-conversation-run.constants"
import { EvaluationConversationRun } from "./evaluation-conversation-run.entity"
import { batchArray } from "./evaluation-conversation-run.helpers"
import type {
  ExecuteEvaluationConversationRunJobPayload,
  ProcessEvaluationConversationRunRecordJobPayload,
} from "./evaluation-conversation-run.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationRunStatusNotifierService } from "./evaluation-conversation-run-status-notifier.service"
import { EvaluationConversationRunRecord } from "./records/evaluation-conversation-run-record.entity"

const BATCH_SIZE = 500

@Injectable()
export class EvaluationConversationRunStarterService {
  private readonly logger = new Logger(EvaluationConversationRunStarterService.name)
  private readonly runConnectRepository: ConnectRepository<EvaluationConversationRun>
  private readonly runRecordConnectRepository: ConnectRepository<EvaluationConversationRunRecord>
  private readonly datasetConnectRepository: ConnectRepository<EvaluationConversationDataset>
  private readonly datasetRecordConnectRepository: ConnectRepository<EvaluationConversationDatasetRecord>
  private readonly agentConnectRepository: ConnectRepository<Agent>
  private readonly agentSettingsConnectRepository: ConnectRepository<AgentSettings>

  constructor(
    @InjectRepository(EvaluationConversationRun)
    runRepository: Repository<EvaluationConversationRun>,
    @InjectRepository(EvaluationConversationRunRecord)
    runRecordRepository: Repository<EvaluationConversationRunRecord>,
    @InjectRepository(EvaluationConversationDataset)
    datasetRepository: Repository<EvaluationConversationDataset>,
    @InjectRepository(EvaluationConversationDatasetRecord)
    datasetRecordRepository: Repository<EvaluationConversationDatasetRecord>,
    @InjectRepository(Agent)
    agentRepository: Repository<Agent>,
    @InjectRepository(AgentSettings)
    agentSettingsRepository: Repository<AgentSettings>,
    @InjectQueue(EVALUATION_CONVERSATION_RUN_QUEUE_NAME)
    private readonly queue: Queue<ProcessEvaluationConversationRunRecordJobPayload>,
    private readonly statusNotifierService: EvaluationConversationRunStatusNotifierService,
  ) {
    this.runConnectRepository = new ConnectRepository(runRepository, "evaluationConversationRun")
    this.runRecordConnectRepository = new ConnectRepository(
      runRecordRepository,
      "evaluationConversationRunRecord",
    )
    this.datasetConnectRepository = new ConnectRepository(
      datasetRepository,
      "evaluationConversationDataset",
    )
    this.datasetRecordConnectRepository = new ConnectRepository(
      datasetRecordRepository,
      "evaluationConversationDatasetRecord",
    )
    this.agentConnectRepository = new ConnectRepository(agentRepository, "agent")
    this.agentSettingsConnectRepository = new ConnectRepository(
      agentSettingsRepository,
      "agentSettings",
    )
  }

  async startRun(payload: ExecuteEvaluationConversationRunJobPayload): Promise<void> {
    const { evaluationConversationRunId, organizationId, projectId, recordLimit } = payload
    const connectScope: RequiredConnectScope = { organizationId, projectId }

    const run = await this.runConnectRepository.getOneById(
      connectScope,
      evaluationConversationRunId,
    )
    if (!run) {
      throw new NotFoundException(
        `Evaluation conversation run with id ${evaluationConversationRunId} not found`,
      )
    }

    const dataset = await this.datasetConnectRepository.getOneById(
      connectScope,
      run.evaluationConversationDatasetId,
    )
    if (!dataset) {
      throw new NotFoundException(
        `Evaluation conversation dataset with id ${run.evaluationConversationDatasetId} not found`,
      )
    }

    const allDatasetRecords = await this.datasetRecordConnectRepository.find(connectScope, {
      where: { evaluationConversationDatasetId: dataset.id },
    })

    const datasetRecords =
      recordLimit != null ? allDatasetRecords.slice(0, recordLimit) : allDatasetRecords

    if (datasetRecords.length === 0) {
      // Nothing to enqueue: complete the run immediately, otherwise no worker would
      // ever move it out of "running".
      run.summary = { total: 0, graded: 0, errors: 0, running: 0, averageScore: null }
      run.status = "completed"
      await this.runConnectRepository.saveOne(run)
      await this.statusNotifierService.notifyRunStatusChanged({
        evaluationConversationRunId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        status: run.status,
        summary: run.summary,
        updatedAt: run.updatedAt.getTime(),
      })
      return
    }

    const agent = await this.agentConnectRepository.getOneById(connectScope, run.agentId)
    if (!agent) {
      throw new NotFoundException(`Agent with id ${run.agentId} not found`)
    }

    const agentSettings = await this.agentSettingsConnectRepository.getOneById(
      connectScope,
      run.agentSettingsId,
    )
    if (!agentSettings) {
      throw new NotFoundException(`AgentSettings with id ${run.agentSettingsId} not found`)
    }

    const runRecords: EvaluationConversationRunRecord[] = []

    try {
      // Create all run records and persist the run summary BEFORE enqueueing any job:
      // a fast worker recomputes the summary as soon as it picks a job up and would
      // otherwise race a run whose summary is still null.
      for (const batch of batchArray(datasetRecords, BATCH_SIZE)) {
        const batchRunRecords = await this.runRecordConnectRepository.createAndSaveMany({
          connectScope,
          entities: batch.map((datasetRecord) => ({
            evaluationConversationRunId: run.id,
            evaluationConversationDatasetRecordId: datasetRecord.id,
            status: "running" as const,
            // Snapshot the dataset record content at fan-out time.
            input: datasetRecord.input,
            expectedOutput: datasetRecord.expectedOutput,
            output: null,
            score: null,
            errorDetails: null,
            traceId: null,
          })),
          chunkSize: BATCH_SIZE,
        })
        runRecords.push(...batchRunRecords)
      }

      run.summary = {
        total: runRecords.length,
        graded: 0,
        errors: 0,
        running: runRecords.length,
        averageScore: null,
      }
      run.status = "running"
      await this.runConnectRepository.saveOne(run)

      await Promise.all(
        batchArray(runRecords, BATCH_SIZE).map((batch) =>
          this.queue.addBulk(
            batch.map((runRecord) => ({
              name: EVALUATION_CONVERSATION_RUN_RECORD_JOB_NAME,
              data: {
                evaluationConversationRun: run,
                runRecordId: runRecord.id,
                connectScope,
                agentWithSettings: toAgentWithSettingsRunJobPayload({
                  agent,
                  agentSettings,
                }),
              },
              opts: { jobId: runRecord.id },
            })),
          ),
        ),
      )
    } catch (error) {
      this.logger.error(
        `Failed to start evaluation run ${run.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
      run.status = "failed"
      await this.runConnectRepository.saveOne(run)

      await Promise.all(
        runRecords.map((runRecord) => {
          runRecord.status = "error"
          return this.runRecordConnectRepository.saveOne(runRecord)
        }),
      )

      throw new UnprocessableEntityException(
        `Failed to start evaluation run ${run.id}. Error: ${error instanceof Error ? error.message : "No error message"}`,
      )
    }
  }
}
