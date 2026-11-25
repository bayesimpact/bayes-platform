import type {
  CampaignReportDistributionOutputDto,
  CampaignReportOutputDto,
  CampaignReportSessionOutputDto,
} from "@caseai-connect/eval-contracts"
import { hasOwnKey } from "@/lib/has-own-key"

const SESSION_HEADER = [
  "sessionId",
  "testerUserId",
  "startedAt",
  "testerRating",
  "reviewerCount",
  "meanReviewerRating",
  "reviewerRatingSpread",
  "reviewerRatings",
]

type Cell = string | number | null

/** A column of the answers to one question: its header, and how to read a session's cell. */
type QuestionColumn = {
  header: string
  cellOf: (session: CampaignReportSessionOutputDto) => Cell
}

/**
 * A character a spreadsheet reads as the start of a formula, at the start of a text or after a
 * character it may split cells on: a French spreadsheet splits a CSV file on semicolons.
 */
const FORMULA_START = /(^|[,;\t\r\n])([=+\-@\t\r])/g

/**
 * A cell as RFC 4180 writes it: quoted when it holds a comma, a semicolon, a quote or a line break.
 * Testers and reviewers write the answers, so each part of a text that a spreadsheet would run as a
 * formula gets a leading apostrophe.
 */
function cellOf(value: Cell): string {
  if (value === null) return ""
  const text = typeof value === "string" ? value.replace(FORMULA_START, "$1'$2") : String(value)
  return /[",;\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function answerOf(answers: Record<string, string>, questionId: string): Cell {
  return hasOwnKey(answers, questionId) ? (answers[questionId] ?? null) : null
}

/** The reviewers' answers in one cell, in the order of their ratings, separated by semicolons. */
function reviewerAnswersOf(answers: Record<string, string[]>, questionId: string): Cell {
  const values = hasOwnKey(answers, questionId) ? (answers[questionId] ?? []) : []
  return values.some((value) => value !== "") ? values.join(";") : null
}

/** One column per question of a form, named by the form and the question's prompt. */
function questionColumnsOf(
  formName: string,
  distributions: CampaignReportDistributionOutputDto[],
  answerCellOf: (session: CampaignReportSessionOutputDto, questionId: string) => Cell,
): QuestionColumn[] {
  return distributions.map((distribution) => ({
    header: `${formName}: ${distribution.prompt}`,
    cellOf: (session) => answerCellOf(session, distribution.questionId),
  }))
}

/**
 * The sessions of a report as a CSV file, one row per session: the tester's rating against the
 * reviewers', whose ratings share one cell, separated by semicolons. Then one column per question
 * of each form, in the report's order: the tester's answer after the session, the tester's answer
 * in their final survey, the same on each of their sessions, and the reviewers' answers, which
 * share one cell as their ratings do.
 */
export function reportCsvOf(report: CampaignReportOutputDto): string {
  const questionColumns = [
    ...questionColumnsOf(
      "After each session",
      report.testerPerSessionDistributions,
      (session, questionId) => answerOf(session.testerAnswers, questionId),
    ),
    ...questionColumnsOf(
      "Final survey",
      report.testerEndOfPhaseDistributions,
      (session, questionId) => answerOf(session.endOfPhaseAnswers, questionId),
    ),
    ...questionColumnsOf("Session review", report.reviewerDistributions, (session, questionId) =>
      reviewerAnswersOf(session.reviewerAnswers, questionId),
    ),
  ]
  const header = [...SESSION_HEADER, ...questionColumns.map((column) => column.header)]
  const rows = report.sessionMatrix.map((session) => [
    session.sessionId,
    session.testerUserId,
    new Date(session.startedAt).toISOString(),
    session.testerRating,
    session.reviewerCount,
    session.meanReviewerRating,
    session.reviewerRatingSpread,
    session.reviewerRatings.join(";"),
    ...questionColumns.map((column) => column.cellOf(session)),
  ])
  return [header, ...rows].map((row) => row.map(cellOf).join(",")).join("\r\n")
}
