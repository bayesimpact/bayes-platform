import type {
  ExtractionDatasetFileColumnOutputDto,
  ExtractionDatasetFileOutputDto,
  ExtractionDatasetOutputDto,
  ExtractionDatasetRecordOutputDto,
} from "@bayes-platform/eval-contracts"
import type { EvaluationExtractionDatasetsService } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-datasets.service"

type ExtractionDatasetFile = Awaited<
  ReturnType<EvaluationExtractionDatasetsService["listFiles"]>
>[number]

type ExtractionDatasetFileColumn = Awaited<
  ReturnType<EvaluationExtractionDatasetsService["getFileColumns"]>
>[number]

type ExtractionDataset = Awaited<
  ReturnType<EvaluationExtractionDatasetsService["listDatasets"]>
>[number]

type ExtractionDatasetRecord = Awaited<
  ReturnType<EvaluationExtractionDatasetsService["listDatasetRecordsPaginated"]>
>["records"][number]

/** A file a dataset is built from, with the fields Evaluation reads. */
export function toExtractionDatasetFileDto(
  file: ExtractionDatasetFile,
): ExtractionDatasetFileOutputDto {
  return {
    id: file.id,
    fileName: file.fileName,
    size: file.size,
    mimeType: file.mimeType,
    createdAt: file.createdAt.getTime(),
    updatedAt: file.updatedAt.getTime(),
  }
}

/**
 * A column of a file, with its first values. A row shorter than the header gives no value, which
 * the old response sent as `null`.
 */
export function toExtractionDatasetFileColumnDto(
  column: ExtractionDatasetFileColumn,
): ExtractionDatasetFileColumnOutputDto {
  return {
    id: column.id,
    name: column.name,
    values: column.values.map((value) => {
      if (value === undefined) return null
      return typeof value === "string" ? value : JSON.stringify(value)
    }),
  }
}

/** A dataset, with the fields Evaluation reads. */
export function toExtractionDatasetDto({
  dataset,
  recordCount,
}: {
  dataset: ExtractionDataset
  recordCount: number
}): ExtractionDatasetOutputDto {
  return {
    id: dataset.id,
    name: dataset.name,
    recordCount,
    schemaMapping: dataset.schemaMapping,
    updatedAt: dataset.updatedAt.getTime(),
  }
}

/** A record of a dataset. */
export function toExtractionDatasetRecordDto(
  record: ExtractionDatasetRecord,
): ExtractionDatasetRecordOutputDto {
  return { id: record.id, data: record.data }
}
