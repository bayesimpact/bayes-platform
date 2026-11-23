import type { CampaignReportSessionOutputDto } from "@caseai-connect/eval-contracts"

const HEADER = [
  "sessionId",
  "testerUserId",
  "startedAt",
  "testerRating",
  "reviewerCount",
  "meanReviewerRating",
  "reviewerRatingSpread",
  "reviewerRatings",
]

/** A cell as RFC 4180 writes it: quoted when it holds a comma, a quote or a line break. */
function cellOf(value: string | number | null): string {
  if (value === null) return ""
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/**
 * The sessions of a report as a CSV file, one row per session: the tester's rating against the
 * reviewers', whose ratings share one cell, separated by semicolons.
 */
export function reportCsvOf(sessions: CampaignReportSessionOutputDto[]): string {
  const rows = sessions.map((session) => [
    session.sessionId,
    session.testerUserId,
    new Date(session.startedAt).toISOString(),
    session.testerRating,
    session.reviewerCount,
    session.meanReviewerRating,
    session.reviewerRatingSpread,
    session.reviewerRatings.join(";"),
  ])
  return [HEADER, ...rows].map((row) => row.map(cellOf).join(",")).join("\r\n")
}
