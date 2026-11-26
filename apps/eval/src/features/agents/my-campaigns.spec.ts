import type { MyReviewCampaignOutputDto } from "@bayes-platform/eval-contracts"
import { describe, expect, it } from "vitest"
import { mergeMyCampaigns } from "./my-campaigns"

const campaign = (name: string): MyReviewCampaignOutputDto => ({
  id: crypto.randomUUID(),
  name,
  description: null,
  status: "active",
  organizationId: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  agentId: crypto.randomUUID(),
  createdAt: Date.now(),
  agent: { name: "Helpful Assistant", type: "conversation" },
})

describe("mergeMyCampaigns", () => {
  it("shows a campaign the person tests and reviews once, with both roles", () => {
    const pilot = campaign("Spring pilot")

    expect(mergeMyCampaigns([pilot], [pilot])).toEqual([
      { ...pilot, roles: ["tester", "reviewer"] },
    ])
  })

  it("sorts the campaigns by name", () => {
    const merged = mergeMyCampaigns([campaign("Pricing answers")], [campaign("Onboarding")])

    expect(merged.map((mine) => [mine.name, mine.roles])).toEqual([
      ["Onboarding", ["reviewer"]],
      ["Pricing answers", ["tester"]],
    ])
  })
})
