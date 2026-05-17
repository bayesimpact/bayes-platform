import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"
import type { Project } from "@/common/features/projects/projects.models"
import type { AgentMessageFeedback } from "./agent-message-feedback.models"

type AgentMessageFeedbackTransientParams = {
  agent: Agent
  project: Project
}

class AgentMessageFeedbackFactory extends Factory<
  AgentMessageFeedback,
  AgentMessageFeedbackTransientParams
> {}

export const agentMessageFeedbackFactory = AgentMessageFeedbackFactory.define(
  ({ params, transientParams }) => {
    const { agent, project } = transientParams
    if (!agent) {
      throw new Error("Agent must be provided in transient params to build an AgentMessageFeedback")
    }
    if (!project) {
      throw new Error(
        "Project must be provided in transient params to build an AgentMessageFeedback",
      )
    }

    return {
      id: params.id ?? faker.string.uuid(),
      organizationId: params.organizationId ?? project.organizationId,
      projectId: params.projectId ?? project.id,
      agentId: params.agentId ?? agent.id,
      agentSessionId: params.agentSessionId ?? faker.string.uuid(),
      agentMessageId: params.agentMessageId ?? faker.string.uuid(),
      agentMessageContent: params.agentMessageContent ?? faker.lorem.paragraph(),
      traceUrl: params.traceUrl ?? faker.internet.url(),
      userId: params.userId ?? faker.string.uuid(),
      content: params.content ?? faker.lorem.sentence(),
      createdAt: params.createdAt ?? faker.date.recent().getTime(),
    }
  },
)
