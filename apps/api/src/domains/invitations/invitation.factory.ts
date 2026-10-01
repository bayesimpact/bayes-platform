import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { Agent } from "@/domains/agents/agent.entity"
import type { Project } from "@/domains/projects/project.entity"
import type { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import type { User } from "@/domains/users/user.entity"
import type { Invitation } from "./invitation.entity"

type InvitationTransientParams = {
  user: User
  /** Exactly one target. */
  project?: Project
  agent?: Agent
  reviewCampaign?: ReviewCampaign
}

class InvitationFactory extends Factory<Invitation, InvitationTransientParams> {
  accepted() {
    return this.params({ status: "accepted", acceptedAt: new Date() })
  }

  revoked() {
    return this.params({ status: "revoked" })
  }
}

export const invitationFactory = InvitationFactory.define(({ params, transientParams }) => {
  const { user, project, agent, reviewCampaign } = transientParams
  if (!user) throw new Error("user transient is required")
  const target = resolveTarget({ project, agent, reviewCampaign })
  const now = new Date()
  return {
    id: params.id || randomUUID(),
    createdAt: params.createdAt || now,
    updatedAt: params.updatedAt || now,
    deletedAt: null,
    ...target,
    userId: user.id,
    invitedEmail: user.email,
    invitationToken: params.invitationToken || randomUUID(),
    status: params.status || "pending",
    role: params.role || target.role,
    invitedAt: params.invitedAt || now,
    acceptedAt: params.acceptedAt ?? null,
  } satisfies Invitation
})

function resolveTarget(targets: Omit<InvitationTransientParams, "user">) {
  if (targets.project) {
    return {
      targetType: "project" as const,
      targetId: targets.project.id,
      organizationId: targets.project.organizationId,
      projectId: targets.project.id,
      role: "admin",
    }
  }
  if (targets.agent) {
    return {
      targetType: "agent" as const,
      targetId: targets.agent.id,
      organizationId: targets.agent.organizationId,
      projectId: targets.agent.projectId,
      role: "member",
    }
  }
  if (targets.reviewCampaign) {
    return {
      targetType: "review_campaign" as const,
      targetId: targets.reviewCampaign.id,
      organizationId: targets.reviewCampaign.organizationId,
      projectId: targets.reviewCampaign.projectId,
      role: "tester",
    }
  }
  throw new Error("a project, agent or reviewCampaign transient is required")
}
