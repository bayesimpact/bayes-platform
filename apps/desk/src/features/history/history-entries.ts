import type {
  AgentTypeDto,
  ConversationSessionOutputDto,
  CsvExtractionRunDetailOutputDto,
  ExtractionRunOutputDto,
} from "@caseai-connect/desk-contracts"

/** The agent whose history the sidebar shows. */
export type HistoryAgent = {
  organizationId: string
  projectId: string
  agentId: string
  type: AgentTypeDto
}

/** How an entry's run went, when it can still be pending or has failed. */
type HistoryEntryState = "done" | "pending" | "failed"

/** One line of the history: a conversation, or the extraction of a document or a CSV file. */
export type HistoryEntry =
  | { kind: "conversation"; id: string; title: string | null; createdAt: number }
  | {
      kind: "extraction"
      id: string
      fileName: string | null
      state: HistoryEntryState
      createdAt: number
    }
  | {
      kind: "csv"
      id: string
      fileName: string | null
      state: HistoryEntryState
      createdAt: number
    }

export function conversationEntries(conversations: ConversationSessionOutputDto[]): HistoryEntry[] {
  return conversations.map((conversation) => ({
    kind: "conversation",
    id: conversation.id,
    title: conversation.title ?? null,
    createdAt: conversation.createdAt,
  }))
}

/**
 * The extractions of documents and CSV files, mixed and sorted newest first. A CSV run takes the
 * name of its file from the person's documents.
 */
export function extractionEntries(
  extractionRuns: ExtractionRunOutputDto[],
  csvExtractionRuns: CsvExtractionRunDetailOutputDto[],
  documents: { id: string; fileName?: string }[],
): HistoryEntry[] {
  const fileNames = new Map(documents.map((document) => [document.id, document.fileName ?? null]))
  const runs: HistoryEntry[] = extractionRuns.map((run) => ({
    kind: "extraction",
    id: run.id,
    fileName: run.documentFileName,
    state: run.status === "success" ? "done" : run.status,
    createdAt: run.createdAt,
  }))
  const csvFiles: HistoryEntry[] = csvExtractionRuns.map((run) => ({
    kind: "csv",
    id: run.id,
    fileName: fileNames.get(run.csvDocumentId) ?? null,
    state: csvRunState(run.status),
    createdAt: run.createdAt,
  }))
  return [...runs, ...csvFiles].sort((first, second) => second.createdAt - first.createdAt)
}

function csvRunState(status: CsvExtractionRunDetailOutputDto["status"]): HistoryEntryState {
  if (status === "pending" || status === "running") return "pending"
  if (status === "failed") return "failed"
  // A cancelled run kept the rows it had extracted: it reads as done.
  return "done"
}

/** The periods the sidebar groups the history by, newest first. */
export type HistoryPeriod = "today" | "yesterday" | "previous7Days" | "previous30Days" | "older"

export type HistoryGroup = { period: HistoryPeriod; entries: HistoryEntry[] }

const PERIODS: HistoryPeriod[] = ["today", "yesterday", "previous7Days", "previous30Days", "older"]

/** The number of calendar days between two moments, in the person's time zone. */
function calendarDaysBetween(earlier: number, later: number): number {
  const startOfDay = (moment: number) => {
    const date = new Date(moment)
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  }
  return Math.round((startOfDay(later) - startOfDay(earlier)) / (24 * 60 * 60 * 1000))
}

function periodOf(createdAt: number, now: number): HistoryPeriod {
  const days = calendarDaysBetween(createdAt, now)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days <= 7) return "previous7Days"
  if (days <= 30) return "previous30Days"
  return "older"
}

/** The entries grouped by period, keeping their order, without the empty periods. */
export function groupByPeriod(entries: HistoryEntry[], now: number): HistoryGroup[] {
  return PERIODS.flatMap((period) => {
    const periodEntries = entries.filter((entry) => periodOf(entry.createdAt, now) === period)
    return periodEntries.length > 0 ? [{ period, entries: periodEntries }] : []
  })
}

/** Whether an extraction of the history still goes on, so the history follows it. */
export function hasPendingRun(
  extractionRuns: ExtractionRunOutputDto[] | undefined,
  csvExtractionRuns: CsvExtractionRunDetailOutputDto[] | undefined,
): boolean {
  return (
    (extractionRuns ?? []).some((run) => run.status === "pending") ||
    (csvExtractionRuns ?? []).some((run) => csvRunState(run.status) === "pending")
  )
}
