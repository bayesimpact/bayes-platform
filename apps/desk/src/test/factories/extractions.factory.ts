import {
  type CsvColumnDto,
  type CsvExtractionRecordOutputDto,
  type CsvFileColumnOutputDto,
  csvColumnSchema,
  csvExtractionRecordOutputSchema,
  csvFileColumnOutputSchema,
  type ExtractionDocumentOutputDto,
  type ExtractionRunDetailOutputDto,
  type ExtractionRunOutputDto,
  extractionDocumentOutputSchema,
  extractionRunDetailOutputSchema,
} from "@caseai-connect/desk-contracts"
import { daysAgo } from "./agent-sessions.factory"

/** The text read in a document, as a neutral sample. */
const SAMPLE_CONTENT = `# Quarterly report

The product gained two features this quarter, and support answered faster.

| Topic | Change |
| --- | --- |
| Product | Two new features |
| Pricing | No change |
| Support | Answers in half the time |`

/** A document the person uploaded for an extraction, checked against the contract. */
export function buildExtractionDocument(
  overrides: Partial<ExtractionDocumentOutputDto> = {},
): ExtractionDocumentOutputDto {
  return extractionDocumentOutputSchema.parse({
    id: crypto.randomUUID(),
    fileName: "quarterly-report.pdf",
    mimeType: "application/pdf",
    size: 2_400_000,
    language: "en",
    content: SAMPLE_CONTENT,
    createdAt: daysAgo(0),
    updatedAt: daysAgo(0),
    ...overrides,
  })
}

/** What the agent reads in a document, as a neutral sample of every kind of value. */
export const SAMPLE_RESULT = {
  title: "Quarterly report",
  summary:
    "The report sums up the quarter: the product gained two features, the prices stayed the same, and support answered faster.",
  language: "en",
  pageCount: 12,
  isSigned: false,
  topics: ["Product", "Pricing", "Support"],
  contact: { name: "Alex Example", email: "alex@example.com" },
  dueDate: null,
}

/** The detail of a run of the history, checked against the contract. */
export function buildExtractionRunDetail(
  run: ExtractionRunOutputDto,
  overrides: Partial<ExtractionRunDetailOutputDto> = {},
): ExtractionRunDetailOutputDto {
  return extractionRunDetailOutputSchema.parse({
    id: run.id,
    documentId: run.documentId,
    status: run.status,
    result: run.status === "success" ? SAMPLE_RESULT : null,
    errorCode: run.status === "failed" ? "PDF_PAGE_LIMIT_EXCEEDED" : null,
    errorDetails:
      run.status === "failed" ? { message: "The PDF has 412 pages; the limit is 300." } : null,
    createdAt: run.createdAt,
    updatedAt: run.status === "pending" ? run.createdAt : run.createdAt + 14_000,
    ...overrides,
  })
}

/** The columns of a CSV file of articles, with their first values. */
export function buildCsvFileColumns(): CsvFileColumnOutputDto[] {
  return [
    { name: "title", values: ["Faster search", "Dark mode", "Exports", "Shared workspaces"] },
    { name: "author", values: ["Alex Example", "Sam Example", "Alex Example", "Kim Example"] },
    { name: "year", values: ["2024", "2025", "2025", "2026"] },
    {
      name: "abstract",
      values: [
        "Search answers in half the time, across every project.",
        "The whole app follows the system's dark theme.",
        "Every table exports as a CSV file.",
        "A team shares its documents in one place.",
      ],
    },
  ].map((column) => csvFileColumnOutputSchema.parse({ id: crypto.randomUUID(), ...column }))
}

/** The columns of a run, from the file's columns: the year stays beside the answers, the rest is read. */
export function columnSchemaOf(columns: CsvFileColumnOutputDto[]): Record<string, CsvColumnDto> {
  return Object.fromEntries(
    columns.map((column, index) => [
      column.id,
      csvColumnSchema.parse({
        id: column.id,
        originalName: column.name,
        finalName: column.name,
        role: column.name === "year" ? "reference" : "input",
        index,
      }),
    ]),
  )
}

const TOPICS = ["Product", "Pricing", "Support"]

/** The rows of a run on a file, still running, or done as the agent answers them. */
export function buildCsvRecords(
  columns: CsvFileColumnOutputDto[],
  count: number,
  status: CsvExtractionRecordOutputDto["status"],
): CsvExtractionRecordOutputDto[] {
  return Array.from({ length: count }, (_, rowIndex) => {
    const inputData = Object.fromEntries(
      columns.map((column) => [
        column.id,
        column.values[rowIndex % column.values.length] ?? `Value ${rowIndex + 1}`,
      ]),
    )
    return buildCsvRecord({
      rowIndex,
      status,
      inputData,
      agentRawOutput: status === "success" ? answerFor(rowIndex) : null,
    })
  })
}

/** One row of a run, done by default, checked against the contract. */
export function buildCsvRecord(
  overrides: Partial<CsvExtractionRecordOutputDto> = {},
): CsvExtractionRecordOutputDto {
  return csvExtractionRecordOutputSchema.parse({
    id: crypto.randomUUID(),
    rowIndex: 0,
    status: "success",
    inputData: {},
    agentRawOutput: answerFor(overrides.rowIndex ?? 0),
    errorDetails: null,
    ...overrides,
  })
}

/** What the agent answers for a row. */
export function answerFor(rowIndex: number): Record<string, unknown> {
  return {
    summary: `Row ${rowIndex + 1} describes a change of the product, in a sentence or two.`,
    topic: TOPICS[rowIndex % TOPICS.length],
    isRelevant: rowIndex % 4 !== 3,
  }
}
