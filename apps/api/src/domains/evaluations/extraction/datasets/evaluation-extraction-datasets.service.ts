import {
  type EvaluationExtractionDatasetSchemaColumnDto,
  MimeTypes,
} from "@caseai-connect/api-contracts"
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import * as Papa from "papaparse"
import type { Repository } from "typeorm"
import { v4 } from "uuid"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import {
  extractFileExtension,
  normalizeUploadedFileName,
} from "@/domains/documents/documents.helpers"
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
import type { EvaluationExtractionDatasetDocument } from "./evaluation-extraction-dataset-document.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionDatasetDocumentRepository } from "./evaluation-extraction-dataset-document.repository"
import {
  EvaluationExtractionDatasetRecord,
  type EvaluationExtractionDatasetRecordData,
} from "./records/evaluation-extraction-dataset-record.entity"

export type EvaluationExtractionDatasetFileColumn = {
  id: string
  name: string
  values: unknown[]
}

const UPLOAD_URL_EXPIRES_IN_SECONDS = 900 // 15 minutes

@Injectable()
export class EvaluationExtractionDatasetsService {
  private readonly logger = new Logger(EvaluationExtractionDatasetsService.name)
  private readonly datasetConnectRepository: ConnectRepository<EvaluationExtractionDataset>
  private readonly recordConnectRepository: ConnectRepository<EvaluationExtractionDatasetRecord>

  constructor(
    @InjectRepository(EvaluationExtractionDataset)
    evaluationExtractionDatasetRepository: Repository<EvaluationExtractionDataset>,
    @InjectRepository(EvaluationExtractionDatasetRecord)
    evaluationExtractionDatasetRecordRepository: Repository<EvaluationExtractionDatasetRecord>,
    private readonly datasetDocumentRepository: EvaluationExtractionDatasetDocumentRepository,
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
  }

  // FILES

  async listFiles({
    connectScope,
  }: {
    connectScope: RequiredConnectScope
  }): Promise<EvaluationExtractionDatasetDocument[]> {
    return this.datasetDocumentRepository.listUploaded(connectScope)
  }

  /**
   * Creates the file row and a signed URL the browser uploads the CSV to. The row
   * stays `pending` until `confirmFile` is called, so a failed upload never shows up
   * in the file list.
   */
  async presignFile({
    connectScope,
    file,
  }: {
    connectScope: RequiredConnectScope
    file: { fileName: string; mimeType: string; size: number }
  }): Promise<{ document: EvaluationExtractionDatasetDocument; uploadUrl: string }> {
    if (file.mimeType !== MimeTypes.csv) {
      throw new UnprocessableEntityException(
        `Invalid file type: ${file.mimeType}. Dataset files must be CSV.`,
      )
    }

    const fileName = normalizeUploadedFileName(file.fileName)
    const extension = extractFileExtension(fileName)
    const documentId = v4()
    const storageRelativePath = this.fileStorageService.buildStorageRelativePath({
      connectScope,
      documentId,
      extension,
    })

    const uploadUrl = await this.fileStorageService.generateSignedUploadUrl({
      storagePath: storageRelativePath,
      mimeType: file.mimeType,
      expiresInSeconds: UPLOAD_URL_EXPIRES_IN_SECONDS,
    })

    const document = await this.datasetDocumentRepository.createPending(connectScope, {
      id: documentId,
      fileName,
      mimeType: file.mimeType,
      size: file.size,
      storageRelativePath,
    })

    return { document, uploadUrl }
  }

  async confirmFile({
    connectScope,
    documentId,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
  }): Promise<EvaluationExtractionDatasetDocument> {
    const isMarked = await this.datasetDocumentRepository.markAsUploaded(connectScope, documentId)
    if (!isMarked) {
      throw new NotFoundException(`Dataset file with id ${documentId} not found`)
    }
    const document = await this.datasetDocumentRepository.findOne(connectScope, documentId)
    if (!document) {
      throw new NotFoundException(`Dataset file with id ${documentId} not found`)
    }
    return document
  }

  async deleteFile({
    connectScope,
    documentId,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
  }): Promise<void> {
    const document = await this.getFile({ connectScope, documentId })
    const isDeleted = await this.datasetDocumentRepository.deleteOne(connectScope, documentId)
    if (!isDeleted) {
      throw new NotFoundException(`Dataset file with id ${documentId} not found`)
    }

    // Storage cleanup happens after the row is gone: a storage hiccup must not
    // resurrect the file, and a missing object is not an error.
    try {
      await this.fileStorageService.deleteFile(document.storageRelativePath)
    } catch (error) {
      this.logger.warn(
        `Could not delete stored file of dataset file ${document.id} (${document.storageRelativePath}): ${(error as Error).message}`,
      )
    }
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
    const document = await this.getFile({ connectScope, documentId })
    return this.parseCsvColumns({ storageRelativePath: document.storageRelativePath, options })
  }

  private async getFile({
    connectScope,
    documentId,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
  }): Promise<EvaluationExtractionDatasetDocument> {
    const document = await this.datasetDocumentRepository.findOne(connectScope, documentId)
    if (!document) {
      throw new NotFoundException(`Dataset file with id ${documentId} not found`)
    }
    return document
  }

  // DATASETS

  private sortNewestFirst = (a: EvaluationExtractionDataset, b: EvaluationExtractionDataset) =>
    b.updatedAt.getTime() - a.updatedAt.getTime()

  async listDatasets({
    connectScope,
  }: {
    connectScope: RequiredConnectScope
  }): Promise<EvaluationExtractionDataset[]> {
    const datasets = await this.datasetConnectRepository.find(connectScope, {})
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

    const document = await this.getFile({ connectScope, documentId })

    Object.assign(dataset, {
      name,
      schemaMapping: this.buildSchemaMapping(columns),
      evaluationExtractionDatasetDocumentId: document.id,
    })
    await this.datasetConnectRepository.saveOne(dataset)

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
    const dataset = await this.datasetConnectRepository.getOneById(connectScope, datasetId)
    if (!dataset) {
      throw new NotFoundException(`Evaluation dataset with id ${datasetId} not found`)
    }

    const document = await this.getFile({ connectScope, documentId })

    const rows = await this.parseCsvRows({
      schemaMapping: dataset.schemaMapping,
      storageRelativePath: document.storageRelativePath,
    })

    // Bulk insert in chunks instead of one INSERT per row: a 10k+ row dataset
    // otherwise issues 10k+ sequential round-trips and times out the request.
    return this.recordConnectRepository.createAndSaveMany({
      connectScope,
      entities: rows.map((row) => ({
        evaluationExtractionDatasetId: datasetId,
        data: row,
      })),
    })
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

    // Dataset records are removed via the ON DELETE CASCADE FK when the dataset row is deleted.
    // The source file is kept: it can be reused to build another dataset.
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

  // CSV PARSING

  private parseCsvColumns({
    storageRelativePath,
    options,
  }: {
    storageRelativePath: string
    options: {
      header: boolean
      preview: number
      skipEmptyLines: boolean
    }
  }): Promise<EvaluationExtractionDatasetFileColumn[]> {
    const sourceStream = this.fileStorageService.createReadStream(storageRelativePath)

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
    storageRelativePath,
  }: {
    schemaMapping: EvaluationExtractionDatasetSchemaMapping
    storageRelativePath: string
  }): Promise<EvaluationExtractionDatasetRecordData[]> {
    const buffer = await this.fileStorageService.readFile(storageRelativePath)
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
