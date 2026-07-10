import { randomUUID } from "node:crypto"
import type { ReviewCampaignMembershipFixture } from "../memberships/review-campaign-membership.types"
import type { ReviewCampaign } from "../review-campaign.entity"
import type { ReviewCampaignStatus } from "../review-campaigns.types"
import { TesterPolicy } from "./tester.policy"

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
    role: overrides.role ?? "tester",
    userId: "user-1",
    id: randomUUID(),
  }) as ReviewCampaignMembershipFixture

describe("TesterPolicy", () => {
  describe("canActAsTester", () => {
    it("returns true when tester membership on active campaign", () => {
      const policy = new TesterPolicy({
        reviewCampaign: campaign({ status: "active" }),
        testerMembership: membership({ role: "tester" }),
        reviewerMembership: undefined,
      })
      expect(policy.canActAsTester()).toBe(true)
    })

    it("returns false when tester membership is missing", () => {
      const policy = new TesterPolicy({
        reviewCampaign: campaign({ status: "active" }),
        testerMembership: undefined,
        reviewerMembership: undefined,
      })
      expect(policy.canActAsTester()).toBe(false)
    })

    it("returns false when only a reviewer membership exists (no tester role)", () => {
      const policy = new TesterPolicy({
        reviewCampaign: campaign({ status: "active" }),
        testerMembership: undefined,
        reviewerMembership: membership({ role: "reviewer" }),
      })
      expect(policy.canActAsTester()).toBe(false)
    })

    it("returns false when tester membership is for a different campaign", () => {
      const policy = new TesterPolicy({
        reviewCampaign: campaign({ id: "campaign-1" }),
        testerMembership: membership({ campaignId: "campaign-2", role: "tester" }),
        reviewerMembership: undefined,
      })
      expect(policy.canActAsTester()).toBe(false)
    })

    it("returns false when campaign is draft", () => {
      const policy = new TesterPolicy({
        reviewCampaign: campaign({ status: "draft" }),
        testerMembership: membership({ role: "tester" }),
        reviewerMembership: undefined,
      })
      expect(policy.canActAsTester()).toBe(false)
    })

    it("returns false when campaign is closed", () => {
      const policy = new TesterPolicy({
        reviewCampaign: campaign({ status: "closed" }),
        testerMembership: membership({ role: "tester" }),
        reviewerMembership: undefined,
      })
      expect(policy.canActAsTester()).toBe(false)
    })

    it("returns true even when the user also has a reviewer membership on the same campaign", () => {
      // Regression: previously the resolver did findOne(...) and could return
      // the reviewer row, making canActAsTester reject a legitimate tester.
      const policy = new TesterPolicy({
        reviewCampaign: campaign({ status: "active" }),
        testerMembership: membership({ role: "tester" }),
        reviewerMembership: membership({ role: "reviewer" }),
      })
      expect(policy.canActAsTester()).toBe(true)
    })
  })

  describe("canViewSharedContext", () => {
    it("allows a tester on an active campaign", () => {
      const policy = new TesterPolicy({
        reviewCampaign: campaign({ status: "active" }),
        testerMembership: membership({ role: "tester" }),
        reviewerMembership: undefined,
      })
      expect(policy.canViewSharedContext()).toBe(true)
    })

    it("rejects a tester on a closed campaign (testers don't see closed campaigns)", () => {
      const policy = new TesterPolicy({
        reviewCampaign: campaign({ status: "closed" }),
        testerMembership: membership({ role: "tester" }),
        reviewerMembership: undefined,
      })
      expect(policy.canViewSharedContext()).toBe(false)
    })

    it("allows a reviewer on an active campaign (shared landing-page metadata)", () => {
      const policy = new TesterPolicy({
        reviewCampaign: campaign({ status: "active" }),
        testerMembership: undefined,
        reviewerMembership: membership({ role: "reviewer" }),
      })
      expect(policy.canViewSharedContext()).toBe(true)
    })

    it("allows a reviewer on a closed campaign (read access stays for closed)", () => {
      const policy = new TesterPolicy({
        reviewCampaign: campaign({ status: "closed" }),
        testerMembership: undefined,
        reviewerMembership: membership({ role: "reviewer" }),
      })
      expect(policy.canViewSharedContext()).toBe(true)
    })

    it("rejects a reviewer on a draft campaign", () => {
      const policy = new TesterPolicy({
        reviewCampaign: campaign({ status: "draft" }),
        testerMembership: undefined,
        reviewerMembership: membership({ role: "reviewer" }),
      })
      expect(policy.canViewSharedContext()).toBe(false)
    })

    it("rejects when memberships are for a different campaign", () => {
      const policy = new TesterPolicy({
        reviewCampaign: campaign({ id: "campaign-1", status: "active" }),
        testerMembership: undefined,
        reviewerMembership: membership({ campaignId: "campaign-2", role: "reviewer" }),
      })
      expect(policy.canViewSharedContext()).toBe(false)
    })

    it("rejects when there is no membership at all", () => {
      const policy = new TesterPolicy({
        reviewCampaign: campaign({ status: "active" }),
        testerMembership: undefined,
        reviewerMembership: undefined,
      })
      expect(policy.canViewSharedContext()).toBe(false)
    })

    it("allows when both roles are held and the campaign is closed (reviewer gate opens)", () => {
      const policy = new TesterPolicy({
        reviewCampaign: campaign({ status: "closed" }),
        testerMembership: membership({ role: "tester" }),
        reviewerMembership: membership({ role: "reviewer" }),
      })
      expect(policy.canViewSharedContext()).toBe(true)
    })
  })

  describe("BasePolicy method aliases", () => {
    const happyPolicy = new TesterPolicy({
      reviewCampaign: campaign({ status: "active" }),
      testerMembership: membership({ role: "tester" }),
      reviewerMembership: undefined,
    })
    const sadPolicy = new TesterPolicy({
      reviewCampaign: campaign({ status: "closed" }),
      testerMembership: membership({ role: "tester" }),
      reviewerMembership: undefined,
    })

    it("canList / canView / canCreate / canUpdate all route through canActAsTester", () => {
      expect(happyPolicy.canList()).toBe(true)
      expect(happyPolicy.canView()).toBe(true)
      expect(happyPolicy.canCreate()).toBe(true)
      expect(happyPolicy.canUpdate()).toBe(true)

      expect(sadPolicy.canList()).toBe(false)
      expect(sadPolicy.canView()).toBe(false)
      expect(sadPolicy.canCreate()).toBe(false)
      expect(sadPolicy.canUpdate()).toBe(false)
    })
  })
})
