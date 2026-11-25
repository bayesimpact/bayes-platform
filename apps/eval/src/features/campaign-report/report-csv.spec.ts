import type {
  CampaignReportDistributionOutputDto,
  CampaignReportOutputDto,
} from "@bayes-platform/eval-contracts"
import { describe, expect, it } from "vitest"
import { reportCsvOf } from "./report-csv"

const HEADER =
  "sessionId,testerUserId,startedAt,testerRating,reviewerCount,meanReviewerRating,reviewerRatingSpread,reviewerRatings"

const emptyReport: CampaignReportOutputDto = {
  showsAnswers: true,
  headline: {
    sessionCount: 0,
    testerFeedbackCount: 0,
    reviewerReviewCount: 0,
    meanTesterRating: null,
    meanReviewerRating: null,
    meanEndOfPhaseRating: null,
    participantCount: 0,
  },
  testerPerSessionDistributions: [],
  testerEndOfPhaseDistributions: [],
  reviewerDistributions: [],
  sessionMatrix: [],
}

const question = (
  questionId: string,
  prompt: string,
  type: CampaignReportDistributionOutputDto["type"],
): CampaignReportDistributionOutputDto => ({
  questionId,
  prompt,
  type,
  responseCount: 0,
  buckets: [],
  textAnswers: [],
})

describe("reportCsvOf", () => {
  it("writes one row per session, with empty cells for what is missing", () => {
    const csv = reportCsvOf({
      ...emptyReport,
      sessionMatrix: [
        {
          sessionId: "11111111-1111-4111-8111-111111111111",
          testerUserId: "22222222-2222-4222-8222-222222222222",
          startedAt: Date.UTC(2026, 10, 3, 9, 30),
          testerRating: 4,
          reviewerRatings: [3, 5],
          reviewerCount: 2,
          meanReviewerRating: 4,
          reviewerRatingSpread: 2,
          testerAnswers: {},
          reviewerAnswers: {},
          endOfPhaseAnswers: {},
        },
        {
          sessionId: "33333333-3333-4333-8333-333333333333",
          testerUserId: "22222222-2222-4222-8222-222222222222",
          startedAt: Date.UTC(2026, 10, 4, 14, 0),
          testerRating: null,
          reviewerRatings: [],
          reviewerCount: 0,
          meanReviewerRating: null,
          reviewerRatingSpread: null,
          testerAnswers: {},
          reviewerAnswers: {},
          endOfPhaseAnswers: {},
        },
      ],
    })

    expect(csv.split("\r\n")).toEqual([
      HEADER,
      '11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222,2026-11-03T09:30:00.000Z,4,2,4,2,"3;5"',
      "33333333-3333-4333-8333-333333333333,22222222-2222-4222-8222-222222222222,2026-11-04T14:00:00.000Z,,0,,,",
    ])
  })

  it("adds one column per question of each form, with each session's answers", () => {
    const csv = reportCsvOf({
      ...emptyReport,
      testerPerSessionDistributions: [
        question("clarity", "Was the answer clear?", "rating"),
        question("missing", "What was missing?", "free-text"),
      ],
      testerEndOfPhaseDistributions: [question("improve", "What should we improve?", "free-text")],
      reviewerDistributions: [
        question("correct", "Was it correct?", "rating"),
        question("mistakes", "What went wrong?", "free-text"),
      ],
      sessionMatrix: [
        {
          sessionId: "11111111-1111-4111-8111-111111111111",
          testerUserId: "22222222-2222-4222-8222-222222222222",
          startedAt: Date.UTC(2026, 10, 3, 9, 30),
          testerRating: 4,
          reviewerRatings: [3, 5, 4],
          reviewerCount: 3,
          meanReviewerRating: 4,
          reviewerRatingSpread: 2,
          testerAnswers: { clarity: "4", missing: 'The "pricing" page, and the FAQ' },
          reviewerAnswers: {
            correct: ["3", "5", "4"],
            mistakes: ["Wrong date", "", "Too long"],
          },
          endOfPhaseAnswers: { improve: "Speed" },
        },
        {
          sessionId: "33333333-3333-4333-8333-333333333333",
          testerUserId: "44444444-4444-4444-8444-444444444444",
          startedAt: Date.UTC(2026, 10, 4, 14, 0),
          testerRating: null,
          reviewerRatings: [2],
          reviewerCount: 1,
          meanReviewerRating: 2,
          reviewerRatingSpread: null,
          testerAnswers: {},
          reviewerAnswers: { correct: ["2"], mistakes: [""] },
          endOfPhaseAnswers: {},
        },
      ],
    })

    expect(csv.split("\r\n")).toEqual([
      `${HEADER},After each session: Was the answer clear?,After each session: What was missing?,Final survey: What should we improve?,Session review: Was it correct?,Session review: What went wrong?`,
      '11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222,2026-11-03T09:30:00.000Z,4,3,4,2,"3;5;4",4,"The ""pricing"" page, and the FAQ",Speed,"3;5;4","Wrong date;;Too long"',
      "33333333-3333-4333-8333-333333333333,44444444-4444-4444-8444-444444444444,2026-11-04T14:00:00.000Z,,1,2,,2,,,,2,",
    ])
  })

  it("keeps an answer or a prompt a spreadsheet would run as a formula as text", () => {
    const csv = reportCsvOf({
      ...emptyReport,
      testerPerSessionDistributions: [question("note", "=1+1", "free-text")],
      reviewerDistributions: [question("issues", "Any issue?", "free-text")],
      sessionMatrix: [
        {
          sessionId: "11111111-1111-4111-8111-111111111111",
          testerUserId: "22222222-2222-4222-8222-222222222222",
          startedAt: Date.UTC(2026, 10, 3, 9, 30),
          testerRating: null,
          reviewerRatings: [3, 4],
          reviewerCount: 2,
          meanReviewerRating: 3.5,
          reviewerRatingSpread: 1,
          testerAnswers: { note: '=HYPERLINK("http://example.com","Open")' },
          reviewerAnswers: { issues: ["@SUM(A1:A2)", "Fine;\t=1+1"] },
          endOfPhaseAnswers: {},
        },
      ],
    })

    const [header, row] = csv.split("\r\n")
    expect(header?.endsWith(",After each session: =1+1,Session review: Any issue?")).toBe(true)
    // Each part a semicolon or a tab starts is neutralized too: a spreadsheet may split on them.
    expect(
      row?.endsWith(`,"'=HYPERLINK(""http://example.com"",""Open"")","'@SUM(A1:A2);Fine;'\t'=1+1"`),
    ).toBe(true)
  })

  it("adds no answer column to the report a reviewer reads, which holds no answer", () => {
    const csv = reportCsvOf({
      ...emptyReport,
      showsAnswers: false,
      testerPerSessionDistributions: [question("clarity", "Was the answer clear?", "rating")],
      reviewerDistributions: [question("mistakes", "What went wrong?", "free-text")],
    })

    expect(csv).toBe(HEADER)
  })

  it("leaves a question's cell empty when an inherited key shares its id", () => {
    const csv = reportCsvOf({
      ...emptyReport,
      testerPerSessionDistributions: [question("constructor", "A question", "free-text")],
      sessionMatrix: [
        {
          sessionId: "11111111-1111-4111-8111-111111111111",
          testerUserId: "22222222-2222-4222-8222-222222222222",
          startedAt: Date.UTC(2026, 10, 3, 9, 30),
          testerRating: null,
          reviewerRatings: [],
          reviewerCount: 0,
          meanReviewerRating: null,
          reviewerRatingSpread: null,
          testerAnswers: {},
          reviewerAnswers: {},
          endOfPhaseAnswers: {},
        },
      ],
    })

    expect(csv.split("\r\n")[1]?.endsWith(",0,,,,")).toBe(true)
  })
})
