import type { CampaignReport, CampaignReportSessionRow } from "./reports.service"

const SESSION_MATRIX_HEADER = [
  "sessionId",
  "agentType",
  "testerUserId",
  "startedAt",
  "testerRating",
  "reviewerCount",
  "meanReviewerRating",
  "reviewerRatingSpread",
  "reviewerRatings",
] as const

/**
 * Serializes the session matrix to RFC 4180-compatible CSV: commas separate
 * columns, CRLF separates rows, values containing comma / quote / newline get
 * wrapped in double quotes with embedded quotes doubled.
 *
 * Only the session matrix is emitted — that's the slice analysts typically
 * pivot on. The distribution and headline sections stay available via the
 * JSON report endpoint.
 */
export function buildSessionMatrixCsv(report: CampaignReport): string {
  const rows: string[][] = [
    [...SESSION_MATRIX_HEADER],
    ...report.sessionMatrix.map(sessionRowToCsvCells),
  ]
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")
}

function sessionRowToCsvCells(row: CampaignReportSessionRow): string[] {
  return [
    row.sessionId,
    row.agentType,
    row.testerUserId,
    row.startedAt.toISOString(),
    formatNullableNumber(row.testerRating),
    String(row.reviewerCount),
    formatNullableNumber(row.meanReviewerRating),
    formatNullableNumber(row.reviewerRatingSpread),
    row.reviewerRatings.join(";"),
  ]
}

function formatNullableNumber(value: number | null): string {
  return value === null ? "" : String(value)
}

function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
