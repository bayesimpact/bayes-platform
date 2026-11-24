import { Readable } from "node:stream"
import { UnprocessableEntityException } from "@nestjs/common"
import { type CsvColumnPreview, readCsvColumns } from "./csv-columns"

const streamOf = (csvContent: string) => Readable.from(Buffer.from(csvContent))

/** A stream that gives one chunk at a time, and counts the chunks the reader asked for. */
const streamOfChunks = (chunks: string[]) => {
  const reading = { chunkCount: 0 }
  function* readChunks() {
    for (const chunk of chunks) {
      reading.chunkCount += 1
      yield Buffer.from(chunk)
    }
  }
  return { sourceStream: Readable.from(readChunks()), reading }
}

/** Lets a stream that nobody stopped read on, so that a spec can tell it was stopped. */
const nextTurnOfTheEventLoop = () => new Promise((resolve) => setImmediate(resolve))

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

  it("leaves a value undefined where a row is shorter than the header", async () => {
    const columns = await readCsvColumns(streamOf("title,summary\nFirst,One\nSecond"), {
      previewRowCount: 5,
    })

    expect(withoutIds(columns)).toEqual([
      { name: "title", values: ["First", "Second"] },
      { name: "summary", values: ["One", undefined] },
    ])
  })

  it("keeps every column of the header when the first row is shorter", async () => {
    const columns = await readCsvColumns(streamOf("title,summary,tag\nFirst\nSecond,Two,B"), {
      previewRowCount: 5,
    })

    expect(withoutIds(columns)).toEqual([
      { name: "title", values: ["First", "Second"] },
      { name: "summary", values: [undefined, "Two"] },
      { name: "tag", values: [undefined, "B"] },
    ])
  })

  it("adds no column when the first row is longer than the header", async () => {
    const columns = await readCsvColumns(streamOf("title,summary\nFirst,One,Extra\nSecond,Two"), {
      previewRowCount: 5,
    })

    expect(withoutIds(columns)).toEqual([
      { name: "title", values: ["First", "Second"] },
      { name: "summary", values: ["One", "Two"] },
    ])
  })

  it("keeps the order of the header for columns named with numbers", async () => {
    const columns = await readCsvColumns(streamOf("2,1,title\nTwo,One,First"), {
      previewRowCount: 5,
    })

    expect(withoutIds(columns)).toEqual([
      { name: "2", values: ["Two"] },
      { name: "1", values: ["One"] },
      { name: "title", values: ["First"] },
    ])
  })

  it("reads the start of a large file only", async () => {
    const tailChunks = Array.from({ length: 1000 }, (_, index) => `tail${index}\n`)
    const { sourceStream, reading } = streamOfChunks(["title\nrow1\nrow2\nrow3\n", ...tailChunks])

    const columns = await readCsvColumns(sourceStream, { previewRowCount: 3 })
    await nextTurnOfTheEventLoop()

    expect(withoutIds(columns)).toEqual([{ name: "title", values: ["row1", "row2", "row3"] }])
    expect(sourceStream.destroyed).toBe(true)
    expect(reading.chunkCount).toBeLessThanOrEqual(3)
  })

  it("reads on when the first chunk holds fewer rows than asked, then stops", async () => {
    const tailChunks = Array.from({ length: 1000 }, (_, index) => `tail${index}\n`)
    const { sourceStream, reading } = streamOfChunks([
      "title\nrow1\nrow2\nro",
      "w3\nrow4\nrow5\nrow6\n",
      ...tailChunks,
    ])

    const columns = await readCsvColumns(sourceStream, { previewRowCount: 5 })
    await nextTurnOfTheEventLoop()

    expect(withoutIds(columns)).toEqual([
      { name: "title", values: ["row1", "row2", "row3", "row4", "row5"] },
    ])
    expect(sourceStream.destroyed).toBe(true)
    expect(reading.chunkCount).toBeLessThanOrEqual(4)
  })

  it("reads a header line that comes in several chunks", async () => {
    const { sourceStream } = streamOfChunks(["tit", "le,sum", "mary\nFirst,One\nSecond,Two\n"])

    const columns = await readCsvColumns(sourceStream, { previewRowCount: 1 })

    expect(withoutIds(columns)).toEqual([
      { name: "title", values: ["First"] },
      { name: "summary", values: ["One"] },
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
