import { describe, expect, it } from "vitest"
import { reportCsvOf } from "./report-csv"

describe("reportCsvOf", () => {
  it("writes one row per session, with empty cells for what is missing", () => {
    const csv = reportCsvOf([
      {
        sessionId: "11111111-1111-4111-8111-111111111111",
        testerUserId: "22222222-2222-4222-8222-222222222222",
        startedAt: Date.UTC(2026, 10, 3, 9, 30),
        testerRating: 4,
        reviewerRatings: [3, 5],
        reviewerCount: 2,
        meanReviewerRating: 4,
        reviewerRatingSpread: 2,
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
      },
    ])

    expect(csv.split("\r\n")).toEqual([
      "sessionId,testerUserId,startedAt,testerRating,reviewerCount,meanReviewerRating,reviewerRatingSpread,reviewerRatings",
      "11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222,2026-11-03T09:30:00.000Z,4,2,4,2,3;5",
      "33333333-3333-4333-8333-333333333333,22222222-2222-4222-8222-222222222222,2026-11-04T14:00:00.000Z,,0,,,",
    ])
  })
})
