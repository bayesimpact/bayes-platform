import type {
  AgentParamsDto,
  AgentTypeDto,
  ConversationSessionOutputDto,
  CsvExtractionRunDetailOutputDto,
  ExtractionRunOutputDto,
} from "@caseai-connect/desk-contracts"
import type { I18n, MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"

/** The agent whose history the sidebar shows: its type says which lists make it. */
export type HistoryAgent = AgentParamsDto & { type: AgentTypeDto }

/** How an entry's run went, when it can still be pending or has failed. */
export type HistoryEntryState = "done" | "pending" | "failed"

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

/** What an entry is named when it has no name of its own, for each kind. */
const UNTITLED_ENTRY_TITLES = {
  conversation: msg`New conversation`,
  extraction: msg`Untitled document`,
  csv: msg({ message: "CSV extraction", comment: "An extraction of every row of a spreadsheet" }),
} as const satisfies Record<HistoryEntry["kind"], MessageDescriptor>

/** An entry's title, as the history, its menu and its toasts show it. */
export function entryTitleOf(entry: HistoryEntry, i18n: I18n): string {
  const name = entry.kind === "conversation" ? entry.title : entry.fileName
  return name ?? i18n._(UNTITLED_ENTRY_TITLES[entry.kind])
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

/** How an extraction of a CSV file shows in the history, for each status the API sends. */
const CSV_RUN_ENTRY_STATES = {
  pending: "pending",
  running: "pending",
  failed: "failed",
  completed: "done",
  // A cancelled run kept the rows it had extracted: it reads as done.
  cancelled: "done",
} as const satisfies Record<CsvExtractionRunDetailOutputDto["status"], HistoryEntryState>

const csvRunState = (status: CsvExtractionRunDetailOutputDto["status"]): HistoryEntryState =>
  CSV_RUN_ENTRY_STATES[status]

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

/** Whether one of these extractions of a document still goes on. */
export function hasPendingExtractionRun(runs: ExtractionRunOutputDto[] | undefined): boolean {
  return (runs ?? []).some((run) => run.status === "pending")
}

/** Whether one of these extractions of a CSV file still goes on. */
export function hasPendingCsvRun(runs: CsvExtractionRunDetailOutputDto[] | undefined): boolean {
  return (runs ?? []).some((run) => csvRunState(run.status) === "pending")
}
