import { describe, expect, it } from "vitest"
import { sidebarCampaignsOf } from "./sidebar-campaigns"

describe("sidebarCampaignsOf", () => {
  it("keeps the agent's campaigns: the active ones, the drafts, then the closed ones", () => {
    const campaigns = [
      { name: "Spring review", agentId: "agent", status: "closed" },
      { name: "Onboarding answers", agentId: "agent", status: "draft" },
      { name: "Other agent", agentId: "other", status: "active" },
      { name: "Support assistant pilot", agentId: "agent", status: "active" },
      { name: "Second draft", agentId: "agent", status: "draft" },
    ] as const

    expect(sidebarCampaignsOf([...campaigns], "agent").map((campaign) => campaign.name)).toEqual([
      "Support assistant pilot",
      "Onboarding answers",
      "Second draft",
      "Spring review",
    ])
  })
})
