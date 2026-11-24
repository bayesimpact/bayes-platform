import { Readable } from "node:stream"
import { UnprocessableEntityException } from "@nestjs/common"
import { type CsvColumnPreview, readCsvColumns } from "./csv-columns"

const streamOf = (csvContent: string) => Readable.from(Buffer.from(csvContent))

/** The columns without their ids, which are new at each read. */
const withoutIds = (columns: CsvColumnPreview[]) =>
  columns.map((column) => ({ name: column.name, values: column.values }))

describe("readCsvColumns", () => {
  it("gives each column its name and the values of the first rows", async () => {
    const columns = await readCsvColumns(streamOf("title,summary\nFirst,One\nSecond,Two"), {
      previewRowCount: 5,
    })

    expect(withoutIds(columns)).toEqual([
      { name: "title", values: ["First", "Second"] },
      { name: "summary", values: ["One", "Two"] },
    ])
  })

  it("gives each column an id of its own", async () => {
    const columns = await readCsvColumns(streamOf("title,summary\nFirst,One"), {
      previewRowCount: 5,
    })

    const ids = columns.map((column) => column.id)
    expect(ids).toEqual([expect.any(String), expect.any(String)])
    expect(new Set(ids).size).toBe(2)
  })

  it("keeps the first rows only, and stops reading the stream", async () => {
    const sourceStream = streamOf("title\nrow1\nrow2\nrow3\nrow4\nrow5\nrow6\nrow7")

    const columns = await readCsvColumns(sourceStream, { previewRowCount: 3 })

    expect(withoutIds(columns)).toEqual([{ name: "title", values: ["row1", "row2", "row3"] }])
    expect(sourceStream.destroyed).toBe(true)
  })

  it.each([
    ["with no final newline", "title,summary"],
    ["with a final newline", "title,summary\n"],
  ])("names the columns of a file with a header and no data row, %s", async (_case, csvContent) => {
    const columns = await readCsvColumns(streamOf(csvContent), { previewRowCount: 5 })

    expect(withoutIds(columns)).toEqual([
      { name: "title", values: [] },
      { name: "summary", values: [] },
    ])
  })

  it("skips the empty lines between the rows", async () => {
    const columns = await readCsvColumns(streamOf("title\n\nFirst\n\nSecond\n"), {
      previewRowCount: 5,
    })

    expect(withoutIds(columns)).toEqual([{ name: "title", values: ["First", "Second"] }])
  })

  it("leaves a value undefined where a row is shorter than the first one", async () => {
    const columns = await readCsvColumns(streamOf("title,summary\nFirst,One\nSecond"), {
      previewRowCount: 5,
    })

    expect(withoutIds(columns)).toEqual([
      { name: "title", values: ["First", "Second"] },
      { name: "summary", values: ["One", undefined] },
    ])
  })

  it.each([
    ["an empty file", ""],
    ["a file of blank lines", "\n\n\n"],
  ])("refuses %s, which has no column", async (_case, csvContent) => {
    const reading = readCsvColumns(streamOf(csvContent), { previewRowCount: 5 })

    await expect(reading).rejects.toThrow(
      new UnprocessableEntityException("CSV file has no columns"),
    )
  })

  it("fails when the stream fails", async () => {
    const sourceStream = new Readable({
      read() {
        this.destroy(new Error("storage is down"))
      },
    })

    await expect(readCsvColumns(sourceStream, { previewRowCount: 5 })).rejects.toThrow(
      "storage is down",
    )
  })
})
