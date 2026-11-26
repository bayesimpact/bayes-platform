import {
  type ExtractionRunKeyMappingEntryDto,
  type ExtractionRunOutputDto,
  type ExtractionRunRecordFieldDto,
  type ExtractionRunRecordOutputDto,
  extractionRunOutputSchema,
  extractionRunRecordOutputSchema,
} from "@bayes-platform/eval-contracts"
import { columnIdOf, type ExtractionDatasetEntry } from "./extraction-datasets.factory"
import { daysAgo } from "./review-campaigns.factory"

/** An extraction run of a project with its records, whole: the handlers page the records. */
export type ExtractionRunEntry = {
  projectId: string
  run: ExtractionRunOutputDto
  records: ExtractionRunRecordOutputDto[]
}

/** How the main runs read the agent's fields: two compared with a column, one only shown. */
const SUPPORT_KEY_MAPPING: ExtractionRunKeyMappingEntryDto[] = [
  { agentOutputKey: "title", datasetColumnId: columnIdOf(1), mode: "scored" },
  { agentOutputKey: "category", datasetColumnId: columnIdOf(2), mode: "scored" },
  { agentOutputKey: "summary", datasetColumnId: "", mode: "fyi" },
]

/** A record of a run, checked against the contract: a match by default. */
export function buildExtractionRunRecord(
  overrides: Partial<ExtractionRunRecordOutputDto> = {},
): ExtractionRunRecordOutputDto {
  return extractionRunRecordOutputSchema.parse({
    id: crypto.randomUUID(),
    evaluationExtractionDatasetRecordId: crypto.randomUUID(),
    status: "match",
    comparison: {
      title: { agentValue: "Sample title", groundTruth: "Sample title", status: "match" },
    },
    errorDetails: null,
    datasetRecordData: { [columnIdOf(0)]: "A sample message." },
    traceUrl: null,
    ...overrides,
  })
}

/** The summary of a run, from its records. */
function summaryOf(records: ExtractionRunRecordOutputDto[]): ExtractionRunOutputDto["summary"] {
  const count = (status: ExtractionRunRecordOutputDto["status"]) =>
    records.filter((record) => record.status === status).length
  return {
    total: records.length,
    perfectMatches: count("match"),
    mismatches: count("mismatch"),
    errors: count("error"),
    running: count("running"),
  }
}

/** A run of an agent over a dataset with its records, checked against the contract. */
export function buildExtractionRun(
  projectId: string,
  overrides: Partial<ExtractionRunOutputDto> &
    Pick<ExtractionRunOutputDto, "agentId" | "evaluationExtractionDatasetId">,
  records: ExtractionRunRecordOutputDto[] = [],
): ExtractionRunEntry {
  const run = extractionRunOutputSchema.parse({
    id: crypto.randomUUID(),
    agentRevision: 3,
    keyMapping: SUPPORT_KEY_MAPPING,
    status: "completed",
    summary: summaryOf(records),
    csvExportDocumentId: null,
    createdAt: daysAgo(1),
    // A run takes a little time: two minutes and five seconds here.
    updatedAt: daysAgo(1) + 125_000,
    ...overrides,
  })
  return { projectId, run, records }
}

/** A record of a run over a row of the dataset: the agent finds each value unless told otherwise. */
function answeredRecord(
  source: ExtractionDatasetEntry["records"][number],
  wrong: { title?: string; category?: string } = {},
): ExtractionRunRecordOutputDto {
  const title = String(source.data[columnIdOf(1)] ?? "")
  const category = String(source.data[columnIdOf(2)] ?? "")
  const field = (truth: string, answer: string | undefined): ExtractionRunRecordFieldDto => ({
    agentValue: answer ?? truth,
    groundTruth: truth,
    status: answer === undefined ? "match" : "mismatch",
  })
  const summary = `The customer writes about: ${title.toLowerCase()}.`
  const isMatch = wrong.title === undefined && wrong.category === undefined
  return buildExtractionRunRecord({
    evaluationExtractionDatasetRecordId: source.id,
    status: isMatch ? "match" : "mismatch",
    comparison: {
      title: field(title, wrong.title),
      category: field(category, wrong.category),
      summary: { agentValue: summary, groundTruth: null, status: "fyi" },
    },
    datasetRecordData: source.data,
  })
}

/** A record of a run with no answer: it waits, it failed, or its run was stopped before it. */
function unansweredRecord(
  source: ExtractionDatasetEntry["records"][number],
  status: "running" | "error" | "cancelled",
): ExtractionRunRecordOutputDto {
  return buildExtractionRunRecord({
    evaluationExtractionDatasetRecordId: source.id,
    status,
    comparison: null,
    errorDetails: status === "error" ? "The model did not answer in time." : null,
    datasetRecordData: source.data,
  })
}

/** A run that is over on a large dataset: its records fill several pages, a few of them wrong. */
export function buildLargeRun(
  projectId: string,
  agentId: string,
  dataset: ExtractionDatasetEntry,
): ExtractionRunEntry {
  return buildExtractionRun(
    projectId,
    {
      agentId,
      evaluationExtractionDatasetId: dataset.dataset.id,
      createdAt: daysAgo(7),
      updatedAt: daysAgo(7) + 640_000,
    },
    dataset.records.map((source, index) =>
      index % 10 === 3 ? answeredRecord(source, { category: "Support" }) : answeredRecord(source),
    ),
  )
}

/**
 * The runs of the main dataset by the main agent: one under way, two over, on two versions, and
 * one that failed. Each takes its records from the dataset's.
 */
export function buildSupportRuns(
  projectId: string,
  agentId: string,
  dataset: ExtractionDatasetEntry,
): ExtractionRunEntry[] {
  const ids = { agentId, evaluationExtractionDatasetId: dataset.dataset.id }
  const rows = dataset.records
  const latest = rows.map((source, index) => {
    if (index === 1) return answeredRecord(source, { category: "Support" })
    if (index === 4) return answeredRecord(source, { title: "The app signs the customer out" })
    if (index === 7) return unansweredRecord(source, "error")
    return answeredRecord(source)
  })
  const earlier = rows.map((source, index) => {
    if (index === 1) return answeredRecord(source, { category: "Support" })
    if (index === 2) return answeredRecord(source, { category: "Product" })
    if (index === 4)
      return answeredRecord(source, { title: "Sign-out problem", category: "Support" })
    if (index === 6) return answeredRecord(source, { title: "Shared workspaces" })
    return answeredRecord(source)
  })
  const underWay = rows.map((source, index) =>
    index < 3 ? answeredRecord(source) : unansweredRecord(source, "running"),
  )
  return [
    buildExtractionRun(
      projectId,
      { ...ids, status: "running", createdAt: Date.now() - 60_000, updatedAt: Date.now() },
      underWay,
    ),
    buildExtractionRun(projectId, { ...ids, csvExportDocumentId: crypto.randomUUID() }, latest),
    buildExtractionRun(
      projectId,
      {
        ...ids,
        agentRevision: 2,
        csvExportDocumentId: crypto.randomUUID(),
        createdAt: daysAgo(4),
        updatedAt: daysAgo(4) + 98_000,
      },
      earlier,
    ),
    buildExtractionRun(
      projectId,
      { ...ids, status: "failed", summary: null, createdAt: daysAgo(6), updatedAt: daysAgo(6) },
      [],
    ),
  ]
}
