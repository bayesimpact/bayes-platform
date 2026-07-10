import { randomUUID } from "node:crypto"
import type { ReviewCampaignMembershipFixture } from "../memberships/review-campaign-membership.types"
import type { ReviewCampaign } from "../review-campaign.entity"
import type { ReviewCampaignStatus } from "../review-campaigns.types"
import { ReviewerPolicy } from "./reviewer.policy"

type CampaignOverrides = { id?: string; status?: ReviewCampaignStatus }
type MembershipOverrides = {
  campaignId?: string
  role?: "tester" | "reviewer"
}

const campaign = (overrides: CampaignOverrides = {}): ReviewCampaign =>
  ({
    id: overrides.id ?? "campaign-1",
    status: overrides.status ?? "active",
  }) as ReviewCampaign

const membership = (overrides: MembershipOverrides): ReviewCampaignMembershipFixture =>
  ({
    campaignId: overrides.campaignId ?? "campaign-1",
    role: overrides.role ?? "reviewer",
    userId: "user-1",
    id: randomUUID(),
  }) as ReviewCampaignMembershipFixture

describe("ReviewerPolicy", () => {
  describe("canReview (write access)", () => {
    it("allows reviewer membership on active campaign", () => {
      const policy = new ReviewerPolicy({
        reviewCampaign: campaign({ status: "active" }),
        reviewerMembership: membership({ role: "reviewer" }),
      })
      expect(policy.canReview()).toBe(true)
    })

    it("rejects missing reviewer membership", () => {
      const policy = new ReviewerPolicy({
        reviewCampaign: campaign({ status: "active" }),
        reviewerMembership: undefined,
      })
      expect(policy.canReview()).toBe(false)
    })

    it("rejects membership for a different campaign", () => {
      const policy = new ReviewerPolicy({
        reviewCampaign: campaign({ id: "campaign-1" }),
        reviewerMembership: membership({ campaignId: "campaign-2" }),
      })
      expect(policy.canReview()).toBe(false)
    })

    it("rejects draft campaigns", () => {
      const policy = new ReviewerPolicy({
        reviewCampaign: campaign({ status: "draft" }),
        reviewerMembership: membership({ role: "reviewer" }),
      })
      expect(policy.canReview()).toBe(false)
    })

    it("rejects closed campaigns (writes freeze on close)", () => {
      const policy = new ReviewerPolicy({
        reviewCampaign: campaign({ status: "closed" }),
        reviewerMembership: membership({ role: "reviewer" }),
      })
      expect(policy.canReview()).toBe(false)
    })
  })

  describe("canView (read access)", () => {
    it("allows active campaign", () => {
      const policy = new ReviewerPolicy({
        reviewCampaign: campaign({ status: "active" }),
        reviewerMembership: membership({ role: "reviewer" }),
      })
      expect(policy.canView()).toBe(true)
    })

    it("allows closed campaign (reviewers keep read access)", () => {
      const policy = new ReviewerPolicy({
        reviewCampaign: campaign({ status: "closed" }),
        reviewerMembership: membership({ role: "reviewer" }),
      })
      expect(policy.canView()).toBe(true)
    })

    it("rejects draft campaign", () => {
      const policy = new ReviewerPolicy({
        reviewCampaign: campaign({ status: "draft" }),
        reviewerMembership: membership({ role: "reviewer" }),
      })
      expect(policy.canView()).toBe(false)
    })

    it("rejects when no reviewer membership is provided", () => {
      const policy = new ReviewerPolicy({
        reviewCampaign: campaign({ status: "active" }),
        reviewerMembership: undefined,
      })
      expect(policy.canView()).toBe(false)
    })
  })

  describe("BasePolicy routing", () => {
    it("canList / canCreate / canUpdate route to the right gate", () => {
      const active = new ReviewerPolicy({
        reviewCampaign: campaign({ status: "active" }),
        reviewerMembership: membership({ role: "reviewer" }),
      })
      expect(active.canList()).toBe(true)
      expect(active.canCreate()).toBe(true)
      expect(active.canUpdate()).toBe(true)

      const closed = new ReviewerPolicy({
        reviewCampaign: campaign({ status: "closed" }),
        reviewerMembership: membership({ role: "reviewer" }),
      })
      // Closed: list (read) allowed, create/update (write) rejected.
      expect(closed.canList()).toBe(true)
      expect(closed.canCreate()).toBe(false)
      expect(closed.canUpdate()).toBe(false)
    })
  })
})
