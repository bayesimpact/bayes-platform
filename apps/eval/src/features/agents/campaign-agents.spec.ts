import type { MyReviewCampaignOutputDto } from "@bayes-platform/eval-contracts"
import { describe, expect, it } from "vitest"
import { campaignAgentsOf, switchableAgentCountOf } from "./campaign-agents"
import type { EvaluationWorkspace } from "./evaluation-agents"
import type { MyCampaign } from "./my-campaigns"

const campaignOn = (
  agentId: string,
  agent: MyReviewCampaignOutputDto["agent"] = { name: "Helpful Assistant", type: "conversation" },
): MyCampaign => ({
  id: crypto.randomUUID(),
  name: "Spring pilot",
  description: null,
  status: "active",
  organizationId: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  agentId,
  createdAt: Date.now(),
  agent,
  roles: ["tester"],
})

const workspaceOf = (
  myCampaigns: MyCampaign[],
  projectAgentIds: string[] = [],
): EvaluationWorkspace => {
  const organization = { id: crypto.randomUUID(), name: "Product" }
  const project = { id: crypto.randomUUID(), name: "Pricing", organization, permissions: [] }
  return {
    projects: [project],
    groups:
      projectAgentIds.length > 0
        ? [
            {
              project,
              agents: projectAgentIds.map((id) => ({
                id,
                name: "Document Reader",
                type: "extraction" as const,
                project,
              })),
            },
          ]
        : [],
    myCampaigns,
  }
}

describe("campaignAgentsOf", () => {
  it("lists each agent of the person's campaigns once, opening its first campaign", () => {
    const agentId = crypto.randomUUID()
    const first = campaignOn(agentId)
    const workspace = workspaceOf([first, campaignOn(agentId)])

    expect(campaignAgentsOf(workspace)).toEqual([
      { id: agentId, name: "Helpful Assistant", type: "conversation", campaign: first },
    ])
  })

  it("leaves out the agents of the person's projects, and the deleted ones", () => {
    const projectAgentId = crypto.randomUUID()
    const workspace = workspaceOf(
      [campaignOn(projectAgentId), campaignOn(crypto.randomUUID(), null)],
      [projectAgentId],
    )

    expect(campaignAgentsOf(workspace)).toEqual([])
    expect(switchableAgentCountOf(workspace)).toBe(1)
  })
})
