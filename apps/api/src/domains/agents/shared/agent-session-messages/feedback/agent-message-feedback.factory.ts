import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { Project } from "@/domains/projects/project.entity"
import type { User } from "@/domains/users/user.entity"
import type { AgentMessage } from "../agent-message.entity"
import type { AgentMessageFeedback } from "./agent-message-feedback.entity"

type AgentMessageFeedbackTransientParams = {
  organization: Organization
  project: Project
  agentMessage: AgentMessage
  user: User
}

class AgentMessageFeedbackFactory extends Factory<
  AgentMessageFeedback,
  AgentMessageFeedbackTransientParams
> {}

export const agentMessageFeedbackFactory = AgentMessageFeedbackFactory.define(
  ({ sequence, params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }
    if (!transientParams.agentMessage) {
      throw new Error("agentMessage transient is required")
    }
    if (!transientParams.user) {
      throw new Error("user transient is required")
    }

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt ?? null,
      organizationId: transientParams.organization.id,
      organization: transientParams.organization,
      projectId: transientParams.project.id,
      project: transientParams.project,
      agentMessageId: transientParams.agentMessage.id,
      agentMessage: transientParams.agentMessage,
      userId: transientParams.user.id,
      user: transientParams.user,
      rating: params.rating ?? "negative",
      content: params.content ?? `Feedback content ${sequence}`,
    } satisfies AgentMessageFeedback
  },
)
