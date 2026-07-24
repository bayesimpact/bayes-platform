import type { CampaignReport } from "./reports.service"
import { buildSessionMatrixCsv } from "./reports-csv"

const baseReport: CampaignReport = {
  campaignId: "campaign-1",
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

describe("buildSessionMatrixCsv", () => {
  it("emits only the header row when the matrix is empty", () => {
    const csv = buildSessionMatrixCsv(baseReport)
    expect(csv).toBe(
      "sessionId,agentType,testerUserId,startedAt,testerRating,reviewerCount,meanReviewerRating,reviewerRatingSpread,reviewerRatings",
    )
  })

  it("renders session rows with ISO dates, numeric ratings, semicolon-joined reviewers", () => {
    const csv = buildSessionMatrixCsv({
      ...baseReport,
      sessionMatrix: [
        {
          sessionId: "sess-1",
          agentType: "conversation",
          testerUserId: "user-alice",
          startedAt: new Date("2026-04-20T14:30:00Z"),
          testerRating: 5,
          reviewerRatings: [3, 4, 5],
          reviewerCount: 3,
          meanReviewerRating: 4,
          reviewerRatingSpread: 2,
        },
      ],
    })
    const lines = csv.split("\r\n")
    expect(lines).toHaveLength(2)
    expect(lines[1]).toBe("sess-1,conversation,user-alice,2026-04-20T14:30:00.000Z,5,3,4,2,3;4;5")
  })

  it("leaves null ratings empty and preserves zero reviewer counts", () => {
    const csv = buildSessionMatrixCsv({
      ...baseReport,
      sessionMatrix: [
        {
          sessionId: "sess-2",
          agentType: "conversation",
          testerUserId: "user-bob",
          startedAt: new Date("2026-04-20T14:30:00Z"),
          testerRating: null,
          reviewerRatings: [],
          reviewerCount: 0,
          meanReviewerRating: null,
          reviewerRatingSpread: null,
        },
      ],
    })
    const [, dataRow] = csv.split("\r\n")
    expect(dataRow).toBe("sess-2,conversation,user-bob,2026-04-20T14:30:00.000Z,,0,,,")
  })

  it("escapes quotes and commas in id-like fields", () => {
    // Defensive: testerUserId would normally be a UUID, but the serializer
    // must not break if a payload ever contains a comma or quote.
    const csv = buildSessionMatrixCsv({
      ...baseReport,
      sessionMatrix: [
        {
          sessionId: "sess,3",
          agentType: "conversation",
          testerUserId: 'user "quoted" id',
          startedAt: new Date("2026-04-20T14:30:00Z"),
          testerRating: 3,
          reviewerRatings: [3],
          reviewerCount: 1,
          meanReviewerRating: 3,
          reviewerRatingSpread: null,
        },
      ],
    })
    const [, dataRow] = csv.split("\r\n")
    expect(dataRow).toBe(
      '"sess,3",conversation,"user ""quoted"" id",2026-04-20T14:30:00.000Z,3,1,3,,3',
    )
  })
})
