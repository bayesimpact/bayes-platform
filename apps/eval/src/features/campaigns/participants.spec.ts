import { describe, expect, it } from "vitest"
import { listParticipants } from "./participants"

describe("listParticipants", () => {
  it("gives a person one row per campaign role, and leaves the other roles out", () => {
    const testerMembershipId = crypto.randomUUID()
    const reviewerMembershipId = crypto.randomUUID()

    const participants = listParticipants([
      {
        userId: crypto.randomUUID(),
        userEmail: "sam@example.org",
        userHasSignedIn: true,
        roles: [
          { membershipId: reviewerMembershipId, key: "review_campaign_reviewer" },
          { membershipId: testerMembershipId, key: "review_campaign_tester" },
          { membershipId: crypto.randomUUID(), key: "constructor" },
        ],
      },
    ])

    expect(participants).toEqual([
      {
        membershipId: testerMembershipId,
        email: "sam@example.org",
        role: "tester",
        hasSignedIn: true,
      },
      {
        membershipId: reviewerMembershipId,
        email: "sam@example.org",
        role: "reviewer",
        hasSignedIn: true,
      },
    ])
  })
})
