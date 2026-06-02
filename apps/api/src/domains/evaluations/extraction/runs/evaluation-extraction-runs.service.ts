import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { Agent } from "@/domains/agents/agent.entity"
import { EvaluationExtractionDataset } from "../datasets/evaluation-extraction-dataset.entity"
import { EvaluationExtractionDatasetRecord } from "../datasets/records/evaluation-extraction-dataset-record.entity"
import {
  EvaluationExtractionRun,
  type EvaluationExtractionRunKeyMapping,
  type EvaluationExtractionRunSummary,
} from "./evaluation-extraction-run.entity"
import {
  EVALUATION_EXTRACTION_RUN_BATCH_SERVICE,
  type EvaluationExtractionRunBatchService,
} from "./evaluation-extraction-run-batch.interface"
import { EvaluationExtractionRunRecord } from "./records/evaluation-extraction-run-record.entity"

const BATCH_SIZE = 500

@Injectable()
export class EvaluationExtractionRunsService {
  private readonly runConnectRepository: ConnectRepository<EvaluationExtractionRun>
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
    @Inject(EVALUATION_EXTRACTION_RUN_BATCH_SERVICE)
    private readonly batchService: EvaluationExtractionRunBatchService,
  ) {
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

  async createRun({
    connectScope,
    fields,
  }: {
    connectScope: RequiredConnectScope
    fields: {
      evaluationExtractionDatasetId: string
      agentId: string
      keyMapping: EvaluationExtractionRunKeyMapping
    }
  }): Promise<EvaluationExtractionRun> {
    // Ensure dataset exists and belongs to the same project/organization before creating run to avoid orphaned runs and to validate access upfront
    await this.getDataset({ id: fields.evaluationExtractionDatasetId, connectScope })

    const agent = await this.agentConnectRepository.getOneById(connectScope, fields.agentId)
    if (!agent) {
      throw new NotFoundException(`Agent with id ${fields.agentId} not found`)
    }

    if (agent.type !== "extraction") {
      throw new UnprocessableEntityException(
        "Only extraction agents can be used for evaluation runs",
      )
    }

    return this.runConnectRepository.createAndSave(connectScope, {
      evaluationExtractionDatasetId: fields.evaluationExtractionDatasetId,
      agentId: fields.agentId,
      keyMapping: fields.keyMapping,
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
  }): Promise<EvaluationExtractionDataset> {
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
  }): Promise<EvaluationExtractionRun | null> {
    return this.runConnectRepository.getOneById(connectScope, runId)
  }

  async markRunCancelled({
    evaluationExtractionRun,
    connectScope,
  }: {
    connectScope: RequiredConnectScope
    evaluationExtractionRun: EvaluationExtractionRun
  }): Promise<EvaluationExtractionRun> {
    if (
      evaluationExtractionRun.status === "completed" ||
      evaluationExtractionRun.status === "failed" ||
      evaluationExtractionRun.status === "cancelled"
    ) {
      throw new UnprocessableEntityException(
        `Evaluation run is in status "${evaluationExtractionRun.status}" and cannot be cancelled`,
      )
    }

    evaluationExtractionRun.status = "cancelled"

    const unfinishedRecords = await this.runRecordConnectRepository.find(connectScope, {
      where: [{ evaluationExtractionRunId: evaluationExtractionRun.id, status: "running" }],
    })

    await Promise.all(
      unfinishedRecords.map((runRecord) => {
        runRecord.status = "error"
        return this.runRecordConnectRepository.saveOne(runRecord)
      }),
    )

    return this.runConnectRepository.saveOne(evaluationExtractionRun)
  }

  async listRuns({
    connectScope,
  }: {
    connectScope: RequiredConnectScope
  }): Promise<EvaluationExtractionRun[]> {
    const runs = await this.runConnectRepository.find(connectScope, {
      order: { createdAt: "DESC" },
    })
    return runs
  }

  async getRunRecords({
    connectScope,
    runId,
  }: {
    connectScope: RequiredConnectScope
    runId: string
  }): Promise<EvaluationExtractionRunRecord[]> {
    return this.runRecordConnectRepository.find(connectScope, {
      where: { evaluationExtractionRunId: runId },
      order: { createdAt: "ASC" },
    })
  }

  async getRunRecordsPaginated({
    connectScope,
    runId,
    page,
    limit,
    columnFilters,
    sortBy,
    sortOrder,
  }: {
    connectScope: RequiredConnectScope
    runId: string
    page: number
    limit: number
    columnFilters?: Record<string, string>
    sortBy?: string
    sortOrder?: "asc" | "desc"
  }): Promise<{ records: EvaluationExtractionRunRecord[]; total: number }> {
    const alias = "evaluationExtractionRunRecord"
    const datasetRecordAlias = "datasetRecord"

    const query = this.runRecordConnectRepository
      .newQueryBuilderWithConnectScope(connectScope)
      .leftJoinAndSelect(`${alias}.evaluationExtractionDatasetRecord`, datasetRecordAlias)
      .andWhere(`${alias}.evaluation_extraction_run_id = :runId`, { runId })

    const safeKeyPattern = /^[a-zA-Z0-9_-]+$/

    if (columnFilters) {
      for (const [columnId, filterValue] of Object.entries(columnFilters)) {
        if (!filterValue) continue
        const paramName = `filter_${columnId.replace(/[^a-zA-Z0-9_]/g, "_")}`

        if (columnId === "status") {
          query.andWhere(`${alias}.status ILIKE :${paramName}`, {
            [paramName]: `%${filterValue}%`,
          })
        } else if (columnId === "errorDetails") {
          query.andWhere(`${alias}.error_details ILIKE :${paramName}`, {
            [paramName]: `%${filterValue}%`,
          })
        } else if (columnId.startsWith("input_") && safeKeyPattern.test(columnId.slice(6))) {
          const dataKey = columnId.slice(6)
          query.andWhere(`${datasetRecordAlias}.data ->> '${dataKey}' ILIKE :${paramName}`, {
            [paramName]: `%${filterValue}%`,
          })
        } else if (columnId.startsWith("target_") && safeKeyPattern.test(columnId.slice(7))) {
          const comparisonKey = columnId.slice(7)
          query.andWhere(
            `${alias}.comparison -> '${comparisonKey}' ->> 'groundTruth' ILIKE :${paramName}`,
            { [paramName]: `%${filterValue}%` },
          )
        } else if (columnId.startsWith("agent_") && safeKeyPattern.test(columnId.slice(6))) {
          const comparisonKey = columnId.slice(6)
          query.andWhere(
            `${alias}.comparison -> '${comparisonKey}' ->> 'agentValue' ILIKE :${paramName}`,
            { [paramName]: `%${filterValue}%` },
          )
        }
      }
    }

    // TypeORM's getManyAndCount with joins resolves orderBy expressions via
    // findColumnWithPropertyPath, which expects entity property names (createdAt),
    // not database column names (created_at). For JSON/JSONB path expressions that
    // can't map to a property, use addSelect with an alias so TypeORM resolves
    // the orderBy via the select alias instead.
    const sortAlias = "__sort_val"
    if (sortBy) {
      const direction = sortOrder === "asc" ? "ASC" : "DESC"
      if (sortBy === "status") {
        query.orderBy(`${alias}.status`, direction)
      } else if (sortBy === "errorDetails") {
        query.orderBy(`${alias}.errorDetails`, direction)
      } else if (sortBy.startsWith("input_") && safeKeyPattern.test(sortBy.slice(6))) {
        const dataKey = sortBy.slice(6)
        query.addSelect(`${datasetRecordAlias}.data ->> '${dataKey}'`, sortAlias)
        query.orderBy(sortAlias, direction)
      } else if (sortBy.startsWith("target_") && safeKeyPattern.test(sortBy.slice(7))) {
        const comparisonKey = sortBy.slice(7)
        query.addSelect(`${alias}.comparison -> '${comparisonKey}' ->> 'groundTruth'`, sortAlias)
        query.orderBy(sortAlias, direction)
      } else if (sortBy.startsWith("agent_") && safeKeyPattern.test(sortBy.slice(6))) {
        const comparisonKey = sortBy.slice(6)
        query.addSelect(`${alias}.comparison -> '${comparisonKey}' ->> 'agentValue'`, sortAlias)
        query.orderBy(sortAlias, direction)
      } else {
        query.orderBy(`${alias}.createdAt`, "ASC")
      }
    } else {
      query.orderBy(`${alias}.createdAt`, "ASC")
    }

    query.skip(page * limit).take(limit)

    const [records, total] = await query.getManyAndCount()

    return { records, total }
  }

  async executeRun({
    evaluationExtractionRun,
    connectScope,
    recordLimit,
  }: {
    evaluationExtractionRun: EvaluationExtractionRun
    connectScope: RequiredConnectScope
    recordLimit?: number | null
  }): Promise<void> {
    const dataset = await this.getDataset({
      id: evaluationExtractionRun.evaluationExtractionDatasetId,
      connectScope,
    })

    const allDatasetRecords = await this.datasetRecordConnectRepository.find(connectScope, {
      where: { evaluationExtractionDatasetId: dataset.id },
    })

    const datasetRecords =
      recordLimit != null ? allDatasetRecords.slice(0, recordLimit) : allDatasetRecords

    const batches = batchArray(datasetRecords, BATCH_SIZE)

    const agent = await this.getAgent({ connectScope, agentId: evaluationExtractionRun.agentId })

    const runRecords: EvaluationExtractionRunRecord[] = []

    try {
      await Promise.all(
        batches.map(async (batch) => {
          const { runRecords: batchRunRecords } = await this.createRunRecords({
            connectScope,
            run: evaluationExtractionRun,
            datasetRecords: batch,
          })
          runRecords.push(...batchRunRecords)

          await this.batchService.enqueueRunRecords(
            batchRunRecords.map((runRecord) => ({
              agent,
              connectScope,
              evaluationExtractionRun,
              runRecordId: runRecord.id,
              schemaMapping: dataset.schemaMapping,
            })),
          )
        }),
      )
    } catch (error) {
      // If enqueueing fails, mark the run as failed and set all records to error to avoid leaving them in a limbo state
      evaluationExtractionRun.status = "failed"
      await this.runConnectRepository.saveOne(evaluationExtractionRun)

      await Promise.all(
        runRecords.map((runRecord) => {
          runRecord.status = "error"
          return this.runRecordConnectRepository.saveOne(runRecord)
        }),
      )

      throw new UnprocessableEntityException(
        `Failed to enqueue jobs for the evaluation run ${evaluationExtractionRun.id}. Error: ${error instanceof Error ? error.message : "No error message"}`,
      )
    }

    evaluationExtractionRun.summary = this.createInitialSummary({
      recordCount: runRecords.length,
    })
    evaluationExtractionRun.status = "running"
    await this.runConnectRepository.saveOne(evaluationExtractionRun)
  }

  private async getAgent({
    connectScope,
    agentId,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
  }): Promise<Agent> {
    const agent = await this.agentConnectRepository.getOneById(connectScope, agentId)
    if (!agent) {
      throw new NotFoundException(`Agent with id ${agentId} not found`)
    }
    return agent
  }

  async retryRun({
    evaluationExtractionRun,
    connectScope,
  }: {
    evaluationExtractionRun: EvaluationExtractionRun
    connectScope: RequiredConnectScope
  }): Promise<void> {
    const dataset = await this.getDataset({
      id: evaluationExtractionRun.evaluationExtractionDatasetId,
      connectScope,
    })
    evaluationExtractionRun.status = "running"
    await this.runConnectRepository.saveOne(evaluationExtractionRun)

    const agent = await this.getAgent({ connectScope, agentId: evaluationExtractionRun.agentId })

    const unfinishedRecords = await this.runRecordConnectRepository.find(connectScope, {
      where: [
        { evaluationExtractionRunId: evaluationExtractionRun.id, status: "running" },
        { evaluationExtractionRunId: evaluationExtractionRun.id, status: "error" },
      ],
    })

    const batches = batchArray(unfinishedRecords, BATCH_SIZE)

    try {
      await Promise.all(
        batches.map(
          async (batch) =>
            await this.batchService.retryRunRecords(
              batch.map((runRecord) => ({
                agent,
                connectScope,
                evaluationExtractionRun,
                runRecordId: runRecord.id,
                schemaMapping: dataset.schemaMapping,
              })),
            ),
        ),
      )
    } catch (error) {
      // If retrying fails, mark the run as failed to avoid leaving it in a limbo state
      evaluationExtractionRun.status = "failed"
      await this.runConnectRepository.saveOne(evaluationExtractionRun)

      throw new UnprocessableEntityException(
        `Failed to retry jobs for the evaluation run ${evaluationExtractionRun.id}. Error: ${error instanceof Error ? error.message : "No error message"}`,
      )
    }
  }

  async removePendingJobsForRun({
    evaluationExtractionRunId,
    connectScope,
  }: {
    evaluationExtractionRunId: string
    connectScope: RequiredConnectScope
  }): Promise<void> {
    const unfinishedRecords = await this.runRecordConnectRepository.find(connectScope, {
      where: { evaluationExtractionRunId, status: "running" },
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
        `Failed to remove pending jobs for the run ${evaluationExtractionRunId}. Error: ${error instanceof Error ? error.message : "No error message"}`,
      )
    }
  }

  private async createRunRecords({
    connectScope,
    run,
    datasetRecords,
  }: {
    datasetRecords: EvaluationExtractionDatasetRecord[]
    connectScope: RequiredConnectScope
    run: EvaluationExtractionRun
  }) {
    const runRecords = await this.runRecordConnectRepository.createAndSaveMany({
      connectScope,
      entities: datasetRecords.map((datasetRecord) => ({
        evaluationExtractionRunId: run.id,
        evaluationExtractionDatasetRecordId: datasetRecord.id,
        status: "running",
        errorDetails: null,
        traceId: null,
      })),
      chunkSize: BATCH_SIZE,
    })

    return { runRecords }
  }

  private createInitialSummary({
    recordCount,
  }: {
    recordCount: number
  }): EvaluationExtractionRunSummary {
    return {
      total: recordCount,
      perfectMatches: 0,
      mismatches: 0,
      errors: 0,
      running: recordCount,
    }
  }
}

function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize))
  }
  return batches
}
