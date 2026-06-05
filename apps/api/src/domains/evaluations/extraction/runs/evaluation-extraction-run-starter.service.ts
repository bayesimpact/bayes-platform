import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Queue } from "bullmq"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { Agent } from "@/domains/agents/agent.entity"
import { EvaluationExtractionDataset } from "../datasets/evaluation-extraction-dataset.entity"
import { EvaluationExtractionDatasetRecord } from "../datasets/records/evaluation-extraction-dataset-record.entity"
import {
  EVALUATION_EXTRACTION_RUN_QUEUE_NAME,
  EVALUATION_EXTRACTION_RUN_RECORD_JOB_NAME,
} from "./evaluation-extraction-run.constants"
import { EvaluationExtractionRun } from "./evaluation-extraction-run.entity"
import type {
  ExecuteEvaluationExtractionRunJobPayload,
  ProcessEvaluationExtractionRunRecordJobPayload,
} from "./evaluation-extraction-run.types"
import { EvaluationExtractionRunRecord } from "./records/evaluation-extraction-run-record.entity"

const BATCH_SIZE = 500

@Injectable()
export class EvaluationExtractionRunStarterService {
  private readonly logger = new Logger(EvaluationExtractionRunStarterService.name)
  private readonly runConnectRepository: ConnectRepository<EvaluationExtractionRun>
  private readonly runRecordConnectRepository: ConnectRepository<EvaluationExtractionRunRecord>
  private readonly datasetConnectRepository: ConnectRepository<EvaluationExtractionDataset>
  private readonly datasetRecordConnectRepository: ConnectRepository<EvaluationExtractionDatasetRecord>
  private readonly agentConnectRepository: ConnectRepository<Agent>

  constructor(
    @InjectRepository(EvaluationExtractionRun)
    runRepository: Repository<EvaluationExtractionRun>,
    @InjectRepository(EvaluationExtractionRunRecord)
    runRecordRepository: Repository<EvaluationExtractionRunRecord>,
    @InjectRepository(EvaluationExtractionDataset)
    datasetRepository: Repository<EvaluationExtractionDataset>,
    @InjectRepository(EvaluationExtractionDatasetRecord)
    datasetRecordRepository: Repository<EvaluationExtractionDatasetRecord>,
    @InjectRepository(Agent)
    agentRepository: Repository<Agent>,
    @InjectQueue(EVALUATION_EXTRACTION_RUN_QUEUE_NAME)
    private readonly queue: Queue<ProcessEvaluationExtractionRunRecordJobPayload>,
  ) {
    this.runConnectRepository = new ConnectRepository(runRepository, "evaluationExtractionRun")
    this.runRecordConnectRepository = new ConnectRepository(
      runRecordRepository,
      "evaluationExtractionRunRecord",
    )
    this.datasetConnectRepository = new ConnectRepository(
      datasetRepository,
      "evaluationExtractionDataset",
    )
    this.datasetRecordConnectRepository = new ConnectRepository(
      datasetRecordRepository,
      "evaluationExtractionDatasetRecord",
    )
    this.agentConnectRepository = new ConnectRepository(agentRepository, "agent")
  }

  async startRun(payload: ExecuteEvaluationExtractionRunJobPayload): Promise<void> {
    const { evaluationExtractionRunId, organizationId, projectId, recordLimit } = payload
    const connectScope: RequiredConnectScope = { organizationId, projectId }

    const run = await this.runConnectRepository.getOneById(connectScope, evaluationExtractionRunId)
    if (!run) {
      throw new NotFoundException(
        `Evaluation extraction run with id ${evaluationExtractionRunId} not found`,
      )
    }

    const dataset = await this.datasetConnectRepository.getOneById(
      connectScope,
      run.evaluationExtractionDatasetId,
    )
    if (!dataset) {
      throw new NotFoundException(
        `Evaluation extraction dataset with id ${run.evaluationExtractionDatasetId} not found`,
      )
    }

    const allDatasetRecords = await this.datasetRecordConnectRepository.find(connectScope, {
      where: { evaluationExtractionDatasetId: dataset.id },
    })

    const datasetRecords =
      recordLimit != null ? allDatasetRecords.slice(0, recordLimit) : allDatasetRecords

    const batches = batchArray(datasetRecords, BATCH_SIZE)

    const agent = await this.agentConnectRepository.getOneById(connectScope, run.agentId)
    if (!agent) {
      throw new NotFoundException(`Agent with id ${run.agentId} not found`)
    }

    const runRecords: EvaluationExtractionRunRecord[] = []

    try {
      await Promise.all(
        batches.map(async (batch) => {
          const batchRunRecords = await this.runRecordConnectRepository.createAndSaveMany({
            connectScope,
            entities: batch.map((datasetRecord) => ({
              evaluationExtractionRunId: run.id,
              evaluationExtractionDatasetRecordId: datasetRecord.id,
              status: "running" as const,
              errorDetails: null,
              traceId: null,
            })),
            chunkSize: BATCH_SIZE,
          })
          runRecords.push(...batchRunRecords)

          await this.queue.addBulk(
            batchRunRecords.map((runRecord) => ({
              name: EVALUATION_EXTRACTION_RUN_RECORD_JOB_NAME,
              data: {
                evaluationExtractionRun: run,
                runRecordId: runRecord.id,
                connectScope,
                schemaMapping: dataset.schemaMapping,
                agent,
              },
              opts: { jobId: runRecord.id },
            })),
          )
        }),
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

    run.summary = {
      total: runRecords.length,
      perfectMatches: 0,
      mismatches: 0,
      errors: 0,
      running: runRecords.length,
    }
    run.status = "running"
    await this.runConnectRepository.saveOne(run)
  }
}

function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize))
  }
  return batches
}
