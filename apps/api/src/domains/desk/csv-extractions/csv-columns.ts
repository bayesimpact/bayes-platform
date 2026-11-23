import { randomUUID } from "node:crypto"
import type { CsvFileColumnOutputDto } from "@caseai-connect/desk-contracts"
import { UnprocessableEntityException } from "@nestjs/common"
import * as Papa from "papaparse"
import type { IFileStorage } from "@/domains/documents/storage/file-storage.interface"

/** How many rows of the file give each column its first values. */
const PREVIEW_ROW_COUNT = 5

/**
 * The columns of a stored CSV file, each with the values of its first rows. It reads only the
 * first rows of the stream. A copy of the `parseCsvColumns` of `AgentCsvExtractionRunsController`.
 */
export function parseCsvColumns({
  fileStorageService,
  storageRelativePath,
}: {
  fileStorageService: IFileStorage
  storageRelativePath: string
}): Promise<CsvFileColumnOutputDto[]> {
  const sourceStream = fileStorageService.createReadStream(storageRelativePath)

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
          id: randomUUID(),
          name: fieldName,
          values: previewRows.map((row) => row[fieldName] ?? null),
        })),
      )
    }

    const settle = (settleWith: () => void) => {
      if (settled) return
      settled = true
      sourceStream.destroy()
      settleWith()
    }

    const parseStream = Papa.parse(Papa.NODE_STREAM_INPUT, {
      header: true,
      skipEmptyLines: true,
    })

    parseStream.on("data", (row: Record<string, unknown>) => {
      if (!fields) fields = Object.keys(row)
      previewRows.push(row)
      if (previewRows.length >= PREVIEW_ROW_COUNT) {
        settle(buildColumns)
      }
    })
    parseStream.on("end", () => settle(buildColumns))
    parseStream.on("error", (error: Error) => settle(() => reject(error)))
    sourceStream.on("error", (error: Error) => settle(() => reject(error)))
    // Papa's stream is a Duplex at runtime; its typings give a plain ReadWriteStream.
    sourceStream.pipe(parseStream as unknown as NodeJS.WritableStream)
  })
}
