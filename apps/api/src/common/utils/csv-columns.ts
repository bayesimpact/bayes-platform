import { randomUUID } from "node:crypto"
import type { Readable } from "node:stream"
import { UnprocessableEntityException } from "@nestjs/common"
import * as Papa from "papaparse"

/** A column of a CSV file: its name in the header line, and its values in the first rows. */
export type CsvColumnPreview = {
  /** An id of its own, new at each read: a file may name two columns alike. */
  id: string
  name: string
  /** One value per row read; `undefined` where a row is shorter than the first one. */
  values: unknown[]
}

/** How many rows of a file give each column its first values, unless the caller asks another count. */
const DEFAULT_PREVIEW_ROW_COUNT = 5

/**
 * The config of Papa's stream mode. Its typings leave `chunk` out of that mode, but the stream
 * mode runs it: the header-only case of the spec fails if that ever stops.
 */
type StreamParseConfig = Papa.ParseConfig & Pick<Papa.ParseLocalConfig, "chunk">

/**
 * The columns of a CSV stream whose first line is its header, each with the values of its first
 * `previewRowCount` rows (5 by default). It reads the start of the stream only, then destroys it. The names are
 * those of the first row when there is one, and those of the header line for a file with no data
 * row. A stream with no header line answers 422.
 */
export function readCsvColumns(
  sourceStream: Readable,
  { previewRowCount = DEFAULT_PREVIEW_ROW_COUNT }: { previewRowCount?: number } = {},
): Promise<CsvColumnPreview[]> {
  return new Promise((resolve, reject) => {
    const previewRows: Record<string, unknown>[] = []
    let fields: string[] | undefined
    let headerFields: string[] | undefined
    let settled = false

    const buildColumns = () => {
      // A file with a header and no data row emits no row: its header names its columns.
      const columnNames = fields ?? headerFields
      if (!columnNames || columnNames.length === 0) {
        reject(new UnprocessableEntityException("CSV file has no columns"))
        return
      }
      resolve(
        columnNames.map((columnName) => ({
          id: randomUUID(),
          name: columnName,
          values: previewRows.map((row) => row[columnName]),
        })),
      )
    }

    const settle = (settleWith: () => void) => {
      if (settled) return
      settled = true
      sourceStream.destroy()
      settleWith()
    }

    // In the stream mode Papa keeps `step` and `complete` for itself: `chunk` is the one
    // callback that gives the header, and it runs before the stream ends. A `data` event comes
    // before it, so the header stays a fallback for a file with no row.
    const parseConfig: StreamParseConfig = {
      header: true,
      skipEmptyLines: true,
      chunk: (results) => {
        headerFields = results.meta.fields
      },
    }
    const parseStream = Papa.parse(Papa.NODE_STREAM_INPUT, parseConfig)

    parseStream.on("data", (row: Record<string, unknown>) => {
      if (!fields) fields = Object.keys(row)
      previewRows.push(row)
      if (previewRows.length >= previewRowCount) {
        settle(buildColumns)
      }
    })
    parseStream.on("end", () => settle(buildColumns))
    parseStream.on("error", (error: Error) => settle(() => reject(error)))
    sourceStream.on("error", (error: Error) => settle(() => reject(error)))
    sourceStream.pipe(parseStream)
  })
}
