import { describe, expect, it } from "vitest"
import { toEvaluationPath } from "./legacy-campaign-urls"

const campaign = "/o/org-1/p/project-1/review-campaigns/campaign-1"

describe("toEvaluationPath", () => {
  it.each([
    ["/tester", "/eval/"],
    ["/tester/", "/eval/"],
    [`/tester${campaign}`, `/eval${campaign}/test`],
    [`/tester${campaign}/survey`, `/eval${campaign}/test/survey`],
    [`/tester${campaign}/a/agent-1/as/session-1`, `/eval${campaign}/test/sessions/session-1`],
    ["/reviewer", "/eval/"],
    [`/reviewer${campaign}`, `/eval${campaign}/review`],
    [`/reviewer${campaign}/report`, `/eval${campaign}/review/report`],
    [`/reviewer${campaign}/sessions/session-1`, `/eval${campaign}/review/sessions/session-1`],
  ])("sends %s to %s", (legacyUrl, evaluationPath) => {
    expect(toEvaluationPath(legacyUrl)).toBe(evaluationPath)
  })

  it("finds no page for a URL the former apps never had", () => {
    expect(toEvaluationPath(`/tester${campaign}/unknown`)).toBeNull()
    expect(toEvaluationPath("/studio")).toBeNull()
  })
})
