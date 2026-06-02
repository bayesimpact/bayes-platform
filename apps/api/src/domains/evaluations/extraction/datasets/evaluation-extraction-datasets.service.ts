import type { EvaluationExtractionDatasetSchemaColumnDto } from "@caseai-connect/api-contracts"
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import * as Papa from "papaparse"
import type { Repository } from "typeorm"
import { v4 } from "uuid"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { Document } from "@/domains/documents/document.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "@/domains/documents/documents.service"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunsService } from "../runs/evaluation-extraction-runs.service"
import {
  type DatasetSchemaColumn,
  EvaluationExtractionDataset,
  type EvaluationExtractionDatasetSchemaMapping,
} from "./evaluation-extraction-dataset.entity"
import { EvaluationExtractionDatasetDocument } from "./evaluation-extraction-dataset-document.entity"
import {
  EvaluationExtractionDatasetRecord,
  type EvaluationExtractionDatasetRecordData,
} from "./records/evaluation-extraction-dataset-record.entity"

export type EvaluationExtractionDatasetFileColumn = {
  id: string
  name: string
  values: unknown[]
}

@Injectable()
export class EvaluationExtractionDatasetsService {
  private readonly datasetConnectRepository: ConnectRepository<EvaluationExtractionDataset>
  private readonly recordConnectRepository: ConnectRepository<EvaluationExtractionDatasetRecord>
  private readonly evaluationExtractionDatasetDocumentRepository: Repository<EvaluationExtractionDatasetDocument>

  constructor(
    @InjectRepository(EvaluationExtractionDatasetDocument)
    evaluationExtractionDatasetDocumentRepository: Repository<EvaluationExtractionDatasetDocument>,
    @InjectRepository(EvaluationExtractionDataset)
    evaluationExtractionDatasetRepository: Repository<EvaluationExtractionDataset>,
    @InjectRepository(EvaluationExtractionDatasetRecord)
    evaluationExtractionDatasetRecordRepository: Repository<EvaluationExtractionDatasetRecord>,
    private readonly documentsService: DocumentsService,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
    private readonly evaluationExtractionRunsService: EvaluationExtractionRunsService,
  ) {
    this.datasetConnectRepository = new ConnectRepository(
      evaluationExtractionDatasetRepository,
      "evaluationExtractionDatasets",
    )
    this.recordConnectRepository = new ConnectRepository(
      evaluationExtractionDatasetRecordRepository,
      "evaluationExtractionDatasetRecords",
    )
    this.evaluationExtractionDatasetDocumentRepository =
      evaluationExtractionDatasetDocumentRepository
  }

  async listFiles({ connectScope }: { connectScope: RequiredConnectScope }): Promise<Document[]> {
    return this.documentsService.listBySourceType({
      connectScope,
      sourceType: "evaluationExtractionDataset",
    })
  }

  async getFileColumns({
    connectScope,
    documentId,
    options = { header: true, preview: 5, skipEmptyLines: true },
  }: {
    connectScope: RequiredConnectScope
    documentId: string
    options?: {
      header: boolean
      preview: number
      skipEmptyLines: boolean
    }
  }): Promise<EvaluationExtractionDatasetFileColumn[]> {
    const document = await this.documentsService.findById({
      connectScope,
      documentId,
    })
    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`)
    }
    const columns = await this.parseCsvColumns({ document, options })
    return columns
  }

  private sortNewestFirst = (a: EvaluationExtractionDataset, b: EvaluationExtractionDataset) =>
    b.updatedAt.getTime() - a.updatedAt.getTime()

  async listDatasets({
    connectScope,
  }: {
    connectScope: RequiredConnectScope
  }): Promise<EvaluationExtractionDataset[]> {
    const datasets = await this.datasetConnectRepository.find(connectScope, {
      relations: [
        "evaluationExtractionDatasetDocuments",
        "evaluationExtractionDatasetDocuments.document",
      ],
    })
    return datasets.sort(this.sortNewestFirst)
  }

  async listDatasetRecords({
    connectScope,
    datasetId,
  }: {
    connectScope: RequiredConnectScope
    datasetId: string
  }): Promise<EvaluationExtractionDatasetRecord[]> {
    return this.recordConnectRepository.find(connectScope, {
      where: { evaluationExtractionDatasetId: datasetId },
    })
  }

  async countDatasetRecords({
    connectScope,
    datasetId,
  }: {
    connectScope: RequiredConnectScope
    datasetId: string
  }): Promise<number> {
    const [, count] = await this.recordConnectRepository.findAndCount(connectScope, {
      where: { evaluationExtractionDatasetId: datasetId },
    })
    return count
  }

  async listDatasetRecordsPaginated({
    connectScope,
    datasetId,
    page,
    limit,
    columnFilters,
    sortBy,
    sortOrder,
  }: {
    connectScope: RequiredConnectScope
    datasetId: string
    page: number
    limit: number
    columnFilters?: Record<string, string>
    sortBy?: string
    sortOrder?: "asc" | "desc"
  }): Promise<{ records: EvaluationExtractionDatasetRecord[]; total: number }> {
    const query = this.recordConnectRepository
      .newQueryBuilderWithConnectScope(connectScope)
      .andWhere(
        "evaluationExtractionDatasetRecords.evaluation_extraction_dataset_id = :datasetId",
        { datasetId },
      )

    if (columnFilters) {
      const safeKeyPattern = /^[a-zA-Z0-9_-]+$/
      for (const [columnId, filterValue] of Object.entries(columnFilters)) {
        if (filterValue && safeKeyPattern.test(columnId)) {
          const paramName = `filter_${columnId.replace(/-/g, "_")}`
          query.andWhere(
            `evaluationExtractionDatasetRecords.data ->> '${columnId}' ILIKE :${paramName}`,
            { [paramName]: `%${filterValue}%` },
          )
        }
      }
    }

    if (sortBy && /^[a-zA-Z0-9_-]+$/.test(sortBy)) {
      const direction = sortOrder === "asc" ? "ASC" : "DESC"
      query.orderBy(`evaluationExtractionDatasetRecords.data ->> '${sortBy}'`, direction)
    } else {
      query.orderBy("evaluationExtractionDatasetRecords.created_at", "ASC")
    }

    query.skip(page * limit).take(limit)

    const [records, total] = await query.getManyAndCount()
    return { records, total }
  }

  async createDataset({
    connectScope,
    name,
  }: {
    connectScope: RequiredConnectScope
    name: string
  }): Promise<EvaluationExtractionDataset> {
    if (!name.trim()) {
      throw new UnprocessableEntityException("Dataset name is required")
    }

    const dataset = await this.datasetConnectRepository.createAndSave(connectScope, {
      name,
      schemaMapping: {}, // empty schema mapping by default, user can update the columns later
    })

    return dataset
  }

  async updateDataset({
    connectScope,
    datasetId,
    fields: { name, documentId, columns },
  }: {
    connectScope: RequiredConnectScope
    datasetId: string
    fields: {
      name: string
      documentId: string
      columns: EvaluationExtractionDatasetSchemaColumnDto[]
    }
  }): Promise<EvaluationExtractionDataset> {
    if (!name.trim()) {
      throw new UnprocessableEntityException("Dataset name is required")
    }

    const dataset = await this.datasetConnectRepository.getOneById(connectScope, datasetId)
    if (!dataset) {
      throw new NotFoundException(`Evaluation dataset with id ${datasetId} not found`)
    }

    const document = await this.documentsService.findById({
      connectScope,
      documentId,
    })
    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`)
    }

    const newValues = {
      name,
      schemaMapping: this.buildSchemaMapping(columns),
    }
    Object.assign(dataset, newValues)
    await this.datasetConnectRepository.saveOne(dataset)

    // Link dataset to document
    await this.evaluationExtractionDatasetDocumentRepository.save({
      evaluationExtractionDatasetId: dataset.id,
      documentId,
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
    })

    return dataset
  }

  async createDatasetRecords({
    connectScope,
    documentId,
    datasetId,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
    datasetId: string
  }): Promise<EvaluationExtractionDatasetRecord[]> {
    // TODO: transaction
    const dataset = await this.datasetConnectRepository.getOneById(connectScope, datasetId)
    if (!dataset) {
      throw new NotFoundException(`Evaluation dataset with id ${datasetId} not found`)
    }

    const document = await this.documentsService.findById({
      connectScope,
      documentId,
    })
    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`)
    }

    const rows = await this.parseCsvRows({
      schemaMapping: dataset.schemaMapping,
      document,
    })

    const records: EvaluationExtractionDatasetRecord[] = []
    for (const row of rows) {
      const record = await this.recordConnectRepository.createAndSave(connectScope, {
        evaluationExtractionDatasetId: datasetId,
        data: row,
      })
      records.push(record)
    }

    return records
  }

  private buildSchemaMapping(
    columns: EvaluationExtractionDatasetSchemaColumnDto[],
  ): EvaluationExtractionDatasetSchemaMapping {
    const schemaMapping: EvaluationExtractionDatasetSchemaMapping = {}
    for (const column of columns) {
      schemaMapping[column.id] = {
        finalName: column.finalName,
        id: column.id,
        index: column.index,
        originalName: column.originalName,
        role: column.role,
      }
    }
    return schemaMapping
  }

  async renameDataset({
    connectScope,
    datasetId,
    name,
  }: {
    connectScope: RequiredConnectScope
    datasetId: string
    name: string
  }): Promise<EvaluationExtractionDataset> {
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
    const runs = await this.evaluationExtractionRunsService.listRuns({ connectScope })
    await Promise.all(
      runs
        .filter((run) => run.evaluationExtractionDatasetId === datasetId)
        .map((run) =>
          this.evaluationExtractionRunsService.deleteRun({
            connectScope,
            evaluationExtractionRunId: run.id,
          }),
        ),
    )

    await this.evaluationExtractionDatasetDocumentRepository.delete({
      evaluationExtractionDatasetId: datasetId,
    })

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

  async updateDatasetColumns({
    connectScope,
    datasetId,
    columns,
  }: {
    connectScope: RequiredConnectScope
    datasetId: string
    columns: EvaluationExtractionDatasetSchemaColumnDto[]
  }): Promise<DatasetSchemaColumn[]> {
    const dataset = await this.datasetConnectRepository.getOneById(connectScope, datasetId)

    if (!dataset) {
      throw new NotFoundException(`Evaluation dataset with id ${datasetId} not found`)
    }

    dataset.schemaMapping = this.buildSchemaMapping(columns)
    await this.datasetConnectRepository.saveOne(dataset)

    return columns
  }

  private parseCsvColumns({
    document,
    options,
  }: {
    document: Document
    options: {
      header: boolean
      preview: number
      skipEmptyLines: boolean
    }
  }): Promise<EvaluationExtractionDatasetFileColumn[]> {
    const sourceStream = this.fileStorageService.createReadStream(document.storageRelativePath)

    return new Promise((resolve, reject) => {
      const previewRows: Record<string, unknown>[] = []
      let fields: string[] | undefined
      let settled = false

      const buildColumns = () => {
        if (!fields || fields.length === 0) {
          reject(new UnprocessableEntityException("CSV file has no columns"))
          return
        }
        resolve(
          fields.map((fieldName) => ({
            id: v4(),
            name: fieldName,
            values: previewRows.map((row) => this.standardizedNulls(row[fieldName])),
          })),
        )
      }

      const settle = (fn: () => void) => {
        if (settled) return
        settled = true
        sourceStream.destroy()
        fn()
      }

      const parseStream = Papa.parse(Papa.NODE_STREAM_INPUT, {
        header: options.header,
        skipEmptyLines: options.skipEmptyLines,
      })

      parseStream.on("data", (row: Record<string, unknown>) => {
        if (!fields) fields = Object.keys(row)
        previewRows.push(row)
        if (previewRows.length >= options.preview) {
          settle(buildColumns)
        }
      })
      parseStream.on("end", () => settle(buildColumns))
      parseStream.on("error", (error) => settle(() => reject(error)))
      sourceStream.on("error", (error) => settle(() => reject(error)))
      sourceStream.pipe(parseStream)
    })
  }

  private standardizedNulls(value: unknown): unknown {
    if (
      value === "N/A" ||
      value === "NaN" ||
      value === "" ||
      value === "null" ||
      value === "NULL" ||
      value === "NA"
    ) {
      return null
    }
    return value
  }

  private async parseCsvRows({
    schemaMapping,
    document,
  }: {
    schemaMapping: EvaluationExtractionDatasetSchemaMapping
    document: Document
  }): Promise<EvaluationExtractionDatasetRecordData[]> {
    const buffer = await this.fileStorageService.readFile(document.storageRelativePath)
    const csvContent = buffer.toString("utf-8")

    const parsed = Papa.parse(csvContent, {
      skipEmptyLines: true,
      header: true,
    })

    if (!parsed.meta.fields || parsed.meta.fields.length === 0) {
      throw new UnprocessableEntityException("CSV file has no columns")
    }

    const columns = Object.values(schemaMapping)

    return (parsed.data as Record<string, unknown>[]).map((csvRow) => {
      const row: EvaluationExtractionDatasetRecordData = {}
      for (const column of columns) {
        row[column.id] = this.standardizedNulls(csvRow[column.originalName])
      }
      return row
    })
  }
}
