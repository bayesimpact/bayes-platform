import type { AgentCsvExtractionRun } from "./agent-csv-extraction-run.entity"
import type { AgentCsvExtractionRunRecord } from "./agent-csv-extraction-run-record.entity"

const UTF8_BOM = "\uFEFF"
const STATUS_COLUMN = "Status"

export function buildAgentCsvExtractionRunCsv({
  run,
  records,
}: {
  run: AgentCsvExtractionRun
  records: AgentCsvExtractionRunRecord[]
}): Buffer {
  const columns = Object.values(run.columnSchema).sort(
    (columnA, columnB) => columnA.index - columnB.index,
  )

  const agentOutputKeys = getAgentOutputKeys(records)
  const headers = buildHeaders({ columns, agentOutputKeys })
  const rows = records.map((record) => buildRow({ columns, agentOutputKeys, record }))

  const csv = [headers, ...rows].map(serializeRow).join("\r\n")
  return Buffer.from(UTF8_BOM + csv, "utf-8")
}

function getAgentOutputKeys(records: AgentCsvExtractionRunRecord[]): string[] {
  const keys = new Set<string>()
  for (const record of records) {
    if (record.agentRawOutput) {
      for (const key of Object.keys(record.agentRawOutput)) {
        keys.add(key)
      }
    }
  }
  return Array.from(keys)
}

function buildHeaders({
  columns,
  agentOutputKeys,
}: {
  columns: { originalName: string; role: string }[]
  agentOutputKeys: string[]
}): string[] {
  const headers: string[] = []
  for (const column of columns) {
    headers.push(`${column.originalName} (${column.role})`)
  }
  for (const key of agentOutputKeys) {
    headers.push(`${key} (agent)`)
  }
  headers.push(STATUS_COLUMN)
  return headers
}

function buildRow({
  columns,
  agentOutputKeys,
  record,
}: {
  columns: { id: string }[]
  agentOutputKeys: string[]
  record: AgentCsvExtractionRunRecord
}): string[] {
  const inputData = record.inputData ?? {}
  const agentOutput = record.agentRawOutput ?? {}
  const cells: string[] = []

  for (const column of columns) {
    cells.push(stringifyCell(inputData[column.id]))
  }

  for (const key of agentOutputKeys) {
    cells.push(stringifyCell(agentOutput[key]))
  }

  cells.push(record.status)
  return cells
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

function serializeRow(cells: string[]): string {
  return cells.map(escapeCsvCell).join(",")
}

function escapeCsvCell(cell: string): string {
  if (/[",\r\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`
  }
  return cell
}

export function buildAgentCsvExtractionRunCsvFileName({ runId }: { runId: string }): string {
  return `agent_csv_extraction_${runId}_Results.csv`
}
