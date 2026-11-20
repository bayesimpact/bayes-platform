import {
  type ExtractionDatasetColumnDto,
  type ExtractionDatasetFileColumnOutputDto,
  type ExtractionDatasetFileOutputDto,
  type ExtractionDatasetOutputDto,
  type ExtractionDatasetRecordOutputDto,
  extractionDatasetFileOutputSchema,
  extractionDatasetOutputSchema,
  extractionDatasetRecordOutputSchema,
} from "@caseai-connect/eval-contracts"
import { daysAgo } from "./review-campaigns.factory"

/** A CSV file of a project, whole: its header and its rows, which the handlers read columns from. */
export type ExtractionFileEntry = {
  projectId: string
  file: ExtractionDatasetFileOutputDto
  header: string[]
  rows: string[][]
}

/** An extraction dataset of a project with its records, whole: the handlers page the records. */
export type ExtractionDatasetEntry = {
  projectId: string
  dataset: Omit<ExtractionDatasetOutputDto, "recordCount">
  records: ExtractionDatasetRecordOutputDto[]
}

/** The id of a column of a file, from its place. */
export const columnIdOf = (index: number) => `column-${index}`

/** The header of the main file: what to read, two values to find, a source and a note. */
const SUPPORT_HEADER = ["message", "title", "category", "source", "internal_note"]

/** The rows of the main file: a customer's message, and what an agent should extract from it. */
const SUPPORT_ROWS: string[][] = [
  [
    "Hello, I was charged twice for my Pro plan this month. Can you refund one of the payments?",
    "Charged twice for the Pro plan",
    "Pricing",
    "email",
    "",
  ],
  [
    "The export button does nothing when I click it on the reports page.",
    "Export button does not work",
    "Product",
    "chat",
    "Seen on the web app only",
  ],
  [
    "How do I add a colleague to my workspace? I cannot find the option.",
    "Adding a colleague to a workspace",
    "Support",
    "chat",
    "",
  ],
  [
    "Is there a discount when we pay for a whole year?",
    "Discount for a yearly payment",
    "Pricing",
    "email",
    "",
  ],
  [
    "The mobile app signs me out every time I close it.",
    "Mobile app signs out on close",
    "Product",
    "form",
    "",
  ],
  [
    "I need an invoice with our company's address for last month.",
    "Invoice with a company address",
    "Pricing",
    "email",
    "",
  ],
  [
    "Can you explain how the shared workspaces work?",
    "How shared workspaces work",
    "Support",
    "chat",
    "",
  ],
  [
    "The search returns no result for words with an accent.",
    "Search fails on accented words",
    "Product",
    "form",
    "Reported twice",
  ],
]

/** A CSV file of a project, checked against the contract. */
export function buildExtractionFile(
  projectId: string,
  overrides: Partial<ExtractionDatasetFileOutputDto> = {},
  content: { header: string[]; rows: string[][] } = { header: SUPPORT_HEADER, rows: SUPPORT_ROWS },
): ExtractionFileEntry {
  const file = extractionDatasetFileOutputSchema.parse({
    id: crypto.randomUUID(),
    fileName: "support-messages.csv",
    size: 48_200,
    mimeType: "text/csv",
    createdAt: daysAgo(6),
    updatedAt: daysAgo(6),
    ...overrides,
  })
  return { projectId, file, ...content }
}

/** The columns of a file as the API returns them: each name with its first values. */
export function fileColumnsOf(entry: ExtractionFileEntry): ExtractionDatasetFileColumnOutputDto[] {
  return entry.header.map((name, index) => ({
    id: columnIdOf(index),
    name,
    values: entry.rows.slice(0, 5).map((row) => row[index] ?? ""),
  }))
}

/** The records a file gives a dataset: a value per column id. */
export function recordsOf(entry: ExtractionFileEntry): ExtractionDatasetRecordOutputDto[] {
  return entry.rows.map((row) =>
    extractionDatasetRecordOutputSchema.parse({
      id: crypto.randomUUID(),
      data: Object.fromEntries(row.map((value, index) => [columnIdOf(index), value])),
    }),
  )
}

/** The columns of the main dataset: the message is read, the title and the category are found. */
const SUPPORT_COLUMNS: ExtractionDatasetColumnDto[] = [
  { id: columnIdOf(0), index: 0, originalName: "message", finalName: "message", role: "input" },
  { id: columnIdOf(1), index: 1, originalName: "title", finalName: "title", role: "target" },
  { id: columnIdOf(2), index: 2, originalName: "category", finalName: "category", role: "target" },
  { id: columnIdOf(3), index: 3, originalName: "source", finalName: "source", role: "reference" },
  {
    id: columnIdOf(4),
    index: 4,
    originalName: "internal_note",
    finalName: "internal_note",
    role: "ignore",
  },
]

/** A dataset of a project with its records, checked against the contract: not set up by default. */
export function buildExtractionDataset(
  projectId: string,
  overrides: Partial<Omit<ExtractionDatasetOutputDto, "recordCount">> = {},
  records: ExtractionDatasetRecordOutputDto[] = [],
): ExtractionDatasetEntry {
  const dataset = extractionDatasetOutputSchema.omit({ recordCount: true }).parse({
    id: crypto.randomUUID(),
    name: "Support messages",
    schemaMapping: {},
    updatedAt: daysAgo(1),
    ...overrides,
  })
  return { projectId, dataset, records }
}

/**
 * The files and the datasets of the main project: two files, a dataset built from one of them, a
 * dataset that waits for its file, and a large one, whose records fill several pages.
 */
export function buildSupportDatasets(projectId: string): {
  files: ExtractionFileEntry[]
  datasets: ExtractionDatasetEntry[]
} {
  const file = buildExtractionFile(projectId)
  return {
    files: [
      file,
      buildExtractionFile(
        projectId,
        { fileName: "product-feedback.csv", size: 12_800, createdAt: daysAgo(2) },
        {
          header: ["feedback", "title"],
          rows: [["The new dashboard loads much faster.", "Faster dashboard"]],
        },
      ),
    ],
    datasets: [
      buildExtractionDataset(
        projectId,
        {
          schemaMapping: Object.fromEntries(SUPPORT_COLUMNS.map((column) => [column.id, column])),
        },
        recordsOf(file),
      ),
      buildExtractionDataset(projectId, {
        name: "Product feedback",
        updatedAt: daysAgo(2),
      }),
      buildExtractionDataset(
        projectId,
        {
          name: "All messages",
          schemaMapping: Object.fromEntries(SUPPORT_COLUMNS.map((column) => [column.id, column])),
          updatedAt: daysAgo(8),
        },
        // Enough records for several pages: the main rows, over and over, each with its number.
        recordsOf({
          ...file,
          rows: Array.from({ length: 120 }, (_, index) => {
            const [message = "", ...rest] = SUPPORT_ROWS[index % SUPPORT_ROWS.length] ?? []
            return [`#${index + 1} ${message}`, ...rest]
          }),
        }),
      ),
    ],
  }
}
