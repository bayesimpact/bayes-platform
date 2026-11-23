import {
  EXTRACTION_DATASET_FILE_MAX_SIZE,
  EXTRACTION_DATASET_FILE_MIME_TYPE,
} from "@caseai-connect/eval-contracts"

/** Why a file a person chose cannot be uploaded. */
export type CsvFileProblem = "notCsv" | "tooLarge"

/**
 * What stops a file from being uploaded, if anything: it must be a CSV, by its type or, as some
 * systems type a CSV as a spreadsheet, by its name, and no larger than the limit.
 */
export function csvFileProblemOf(
  file: Pick<File, "name" | "type" | "size">,
): CsvFileProblem | null {
  const isCsv =
    file.type === EXTRACTION_DATASET_FILE_MIME_TYPE || file.name.toLowerCase().endsWith(".csv")
  if (!isCsv) return "notCsv"
  if (file.size > EXTRACTION_DATASET_FILE_MAX_SIZE) return "tooLarge"
  return null
}
