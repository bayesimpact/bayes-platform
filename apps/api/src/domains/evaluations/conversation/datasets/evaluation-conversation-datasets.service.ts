import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationRunsService } from "../runs/evaluation-conversation-runs.service"
import { EvaluationConversationDataset } from "./evaluation-conversation-dataset.entity"
import { EvaluationConversationDatasetRecord } from "./records/evaluation-conversation-dataset-record.entity"

@Injectable()
export class EvaluationConversationDatasetsService {
  private readonly datasetConnectRepository: ConnectRepository<EvaluationConversationDataset>
  private readonly recordConnectRepository: ConnectRepository<EvaluationConversationDatasetRecord>

  constructor(
    @InjectRepository(EvaluationConversationDataset)
    evaluationConversationDatasetRepository: Repository<EvaluationConversationDataset>,
    @InjectRepository(EvaluationConversationDatasetRecord)
    evaluationConversationDatasetRecordRepository: Repository<EvaluationConversationDatasetRecord>,
    private readonly evaluationConversationRunsService: EvaluationConversationRunsService,
  ) {
    this.datasetConnectRepository = new ConnectRepository(
      evaluationConversationDatasetRepository,
      "evaluationConversationDatasets",
    )
    this.recordConnectRepository = new ConnectRepository(
      evaluationConversationDatasetRecordRepository,
      "evaluationConversationDatasetRecords",
    )
  }

  private sortNewestFirst = (a: EvaluationConversationDataset, b: EvaluationConversationDataset) =>
    b.updatedAt.getTime() - a.updatedAt.getTime()

  async listDatasets({
    connectScope,
  }: {
    connectScope: RequiredConnectScope
  }): Promise<EvaluationConversationDataset[]> {
    const datasets = await this.datasetConnectRepository.find(connectScope, {})
    return datasets.sort(this.sortNewestFirst)
  }

  /** Counts records of every dataset of the project in a single GROUP BY query. */
  async countRecordsByDatasetId({
    connectScope,
  }: {
    connectScope: RequiredConnectScope
  }): Promise<Record<string, number>> {
    const rows = await this.recordConnectRepository
      .newQueryBuilderWithConnectScope(connectScope)
      .select(
        "evaluationConversationDatasetRecords.evaluation_conversation_dataset_id",
        "datasetId",
      )
      .addSelect("COUNT(*)", "count")
      .groupBy("evaluationConversationDatasetRecords.evaluation_conversation_dataset_id")
      .getRawMany<{ datasetId: string; count: string }>()

    return Object.fromEntries(rows.map((row) => [row.datasetId, Number(row.count)]))
  }

  async listDatasetRecordsPaginated({
    connectScope,
    datasetId,
    page,
    limit,
  }: {
    connectScope: RequiredConnectScope
    datasetId: string
    page: number
    limit: number
  }): Promise<{ records: EvaluationConversationDatasetRecord[]; total: number }> {
    const query = this.recordConnectRepository
      .newQueryBuilderWithConnectScope(connectScope)
      .andWhere(
        "evaluationConversationDatasetRecords.evaluation_conversation_dataset_id = :datasetId",
        { datasetId },
      )
      .orderBy("evaluationConversationDatasetRecords.created_at", "ASC")
      // Bulk-inserted records share created_at; the id tiebreaker keeps pages stable.
      .addOrderBy("evaluationConversationDatasetRecords.id", "ASC")
      .skip(page * limit)
      .take(limit)

    const [records, total] = await query.getManyAndCount()
    return { records, total }
  }

  async createDataset({
    connectScope,
    name,
  }: {
    connectScope: RequiredConnectScope
    name: string
  }): Promise<EvaluationConversationDataset> {
    if (!name.trim()) {
      throw new UnprocessableEntityException("Dataset name is required")
    }

    const dataset = await this.datasetConnectRepository.createAndSave(connectScope, {
      name,
    })

    return dataset
  }

  async renameDataset({
    connectScope,
    datasetId,
    name,
  }: {
    connectScope: RequiredConnectScope
    datasetId: string
    name: string
  }): Promise<EvaluationConversationDataset> {
    if (!name.trim()) {
      throw new UnprocessableEntityException("Dataset name is required")
    }

    const dataset = await this.datasetConnectRepository.getOneById(connectScope, datasetId)
    if (!dataset) {
      throw new NotFoundException(`Evaluation dataset with id ${datasetId} not found`)
    }

    dataset.name = name
    await this.datasetConnectRepository.saveOne(dataset)

    return dataset
  }

  async deleteDataset({
    connectScope,
    datasetId,
  }: {
    connectScope: RequiredConnectScope
    datasetId: string
  }): Promise<void> {
    const runs = await this.evaluationConversationRunsService.listRuns({ connectScope })
    await Promise.all(
      runs
        .filter((run) => run.evaluationConversationDatasetId === datasetId)
        .map((run) =>
          this.evaluationConversationRunsService.deleteRun({
            connectScope,
            evaluationConversationRunId: run.id,
          }),
        ),
    )

    // Dataset records are removed via the ON DELETE CASCADE FK when the dataset row is deleted.
    const isDeleted = await this.datasetConnectRepository.deleteOneById({
      connectScope,
      id: datasetId,
      softDelete: false,
    })

    if (!isDeleted) {
      throw new NotFoundException(`Evaluation dataset with id ${datasetId} not found`)
    }
  }

  async createRecord({
    connectScope,
    datasetId,
    fields: { input, expectedOutput },
  }: {
    connectScope: RequiredConnectScope
    datasetId: string
    fields: { input: string; expectedOutput: string }
  }): Promise<EvaluationConversationDatasetRecord> {
    if (!input.trim()) {
      throw new UnprocessableEntityException("Record input is required")
    }
    if (!expectedOutput.trim()) {
      throw new UnprocessableEntityException("Record expected output is required")
    }

    const dataset = await this.datasetConnectRepository.getOneById(connectScope, datasetId)
    if (!dataset) {
      throw new NotFoundException(`Evaluation dataset with id ${datasetId} not found`)
    }

    return this.recordConnectRepository.createAndSave(connectScope, {
      evaluationConversationDatasetId: datasetId,
      input,
      expectedOutput,
    })
  }

  async createRecords({
    connectScope,
    datasetId,
    records,
  }: {
    connectScope: RequiredConnectScope
    datasetId: string
    records: Array<{ input: string; expectedOutput: string }>
  }): Promise<EvaluationConversationDatasetRecord[]> {
    if (records.length === 0) {
      throw new UnprocessableEntityException("At least one record is required")
    }
    for (const record of records) {
      if (!record.input.trim()) {
        throw new UnprocessableEntityException("Record input is required")
      }
      if (!record.expectedOutput.trim()) {
        throw new UnprocessableEntityException("Record expected output is required")
      }
    }

    const dataset = await this.datasetConnectRepository.getOneById(connectScope, datasetId)
    if (!dataset) {
      throw new NotFoundException(`Evaluation dataset with id ${datasetId} not found`)
    }

    return this.recordConnectRepository.createAndSaveMany({
      connectScope,
      entities: records.map((record) => ({
        evaluationConversationDatasetId: datasetId,
        input: record.input,
        expectedOutput: record.expectedOutput,
      })),
    })
  }

  async updateRecord({
    connectScope,
    datasetId,
    recordId,
    fields: { input, expectedOutput },
  }: {
    connectScope: RequiredConnectScope
    datasetId: string
    recordId: string
    fields: { input: string; expectedOutput: string }
  }): Promise<EvaluationConversationDatasetRecord> {
    if (!input.trim()) {
      throw new UnprocessableEntityException("Record input is required")
    }
    if (!expectedOutput.trim()) {
      throw new UnprocessableEntityException("Record expected output is required")
    }

    const [record] = await this.recordConnectRepository.find(connectScope, {
      where: { id: recordId, evaluationConversationDatasetId: datasetId },
    })
    if (!record) {
      throw new NotFoundException(`Evaluation dataset record with id ${recordId} not found`)
    }

    record.input = input
    record.expectedOutput = expectedOutput
    await this.recordConnectRepository.saveOne(record)

    return record
  }

  async deleteRecord({
    connectScope,
    datasetId,
    recordId,
  }: {
    connectScope: RequiredConnectScope
    datasetId: string
    recordId: string
  }): Promise<void> {
    const deletedCount = await this.recordConnectRepository.deleteManyBy({
      connectScope,
      where: { id: recordId, evaluationConversationDatasetId: datasetId },
      softDelete: false,
    })

    if (deletedCount === 0) {
      throw new NotFoundException(`Evaluation dataset record with id ${recordId} not found`)
    }
  }
}
