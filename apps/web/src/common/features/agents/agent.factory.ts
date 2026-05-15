import { AgentLocale, AgentModel, DocumentsRagMode } from "@caseai-connect/api-contracts"
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

  const types = ["conversation", "form", "extraction"] as const
  const type = faker.helpers.arrayElement(types)
  return {
    createdAt: params.createdAt ?? faker.date.past().getTime(),
    defaultPrompt: params.defaultPrompt ?? faker.lorem.paragraph(),
    documentsRagMode: params.documentsRagMode ?? DocumentsRagMode.None,
    documentTagIds: params.documentTagIds ?? [],
    greetingMessage: params.greetingMessage ?? null,
    id: params.id ?? faker.string.uuid(),
    locale: params.locale ?? AgentLocale.EN,
    model: params.model ?? AgentModel.Gemini25Flash,
    name: params.name ?? faker.helpers.arrayElement(AGENT_NAMES),
    projectAgentCategoryIds: params.projectAgentCategoryIds ?? [],
    projectId: project.id,
    temperature: params.temperature ?? 0.7,
    type: params.type ?? type,
    updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    usedProjectAgentCategoryIds: params.usedProjectAgentCategoryIds ?? [],
  }
})
