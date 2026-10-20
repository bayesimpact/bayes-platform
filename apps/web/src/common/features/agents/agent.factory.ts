import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"
import type { Agent } from "./agents.models"

type AgentTransientParams = {
  project: Project
  /** False for an agent that was never published, such as a fresh copy: a draft revision only. */
  published?: boolean
}

const AGENT_NAMES = [
  "Helpful Assistant",
  "Research Agent",
  "Drafting Helper",
  "Summary Bot",
  "Triage Assistant",
  "Support Agent",
]

class AgentFactory extends Factory<Agent, AgentTransientParams> {
  /** A fresh copy: never published, with its settings in draft revision 1. */
  unpublished() {
    return this.transient({ published: false }).params({ draftRevision: { number: 1 } })
  }
}

export const agentFactory = AgentFactory.define(({ params, transientParams }) => {
  const { project, published = true } = transientParams
  if (!project) {
    throw new Error("Project must be provided in transient params to build an Agent")
  }

  const types = ["conversation", "extraction"] as const
  return {
    createdAt: params.createdAt ?? faker.date.past().getTime(),
    id: params.id ?? faker.string.uuid(),
    name: params.name ?? faker.helpers.arrayElement(AGENT_NAMES),
    projectId: project.id,
    type: params.type ?? faker.helpers.arrayElement(types),
    currentRevision: published
      ? {
          name: params.currentRevision?.name,
          description: params.currentRevision?.description,
          updatedAt: params.currentRevision?.updatedAt ?? faker.date.recent().getTime(),
          number: params.currentRevision?.number ?? 1,
        }
      : undefined,
    draftRevision: params.draftRevision
      ? {
          name: params.draftRevision.name,
          description: params.draftRevision.description,
          updatedAt: params.draftRevision.updatedAt ?? faker.date.recent().getTime(),
          number: params.draftRevision.number ?? 1,
        }
      : undefined,
  } satisfies Agent
})
