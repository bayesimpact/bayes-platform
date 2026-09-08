import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"
import type { Agent } from "./agents.models"

type AgentTransientParams = {
  project: Project
}

const AGENT_NAMES = [
  "Helpful Assistant",
  "Research Agent",
  "Drafting Helper",
  "Summary Bot",
  "Triage Assistant",
  "Support Agent",
]

class AgentFactory extends Factory<Agent, AgentTransientParams> {}

export const agentFactory = AgentFactory.define(({ params, transientParams }) => {
  const { project } = transientParams
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
    currentRevision: {
      name: params.currentRevision?.name,
      description: params.currentRevision?.description,
      updatedAt: params.currentRevision?.updatedAt ?? faker.date.recent().getTime(),
      number: params.currentRevision?.number ?? 1,
    },
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
