import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"
import type { Organization } from "@/common/features/organizations/organizations.models"
import type { Project } from "@/common/features/projects/projects.models"
import type { PendingInvitationItem, PendingInvitationTargetType } from "./invitations.models"

type PendingInvitationTransientParams = {
  project?: Project
  organization?: Organization
  agent?: Agent
  targetType?: PendingInvitationTargetType
}

class PendingInvitationFactory extends Factory<
  PendingInvitationItem,
  PendingInvitationTransientParams
> {}

export const pendingInvitationFactory = PendingInvitationFactory.define(
  ({ params, transientParams }) => {
    const { project, organization, agent, targetType: transientTargetType } = transientParams
    const targetType = params.targetType ?? transientTargetType ?? "project"
    const resolvedTargetId =
      params.targetId ??
      (targetType === "agent" ? agent?.id : targetType === "project" ? project?.id : undefined) ??
      faker.string.uuid()
    const resolvedTargetName =
      params.targetName ??
      (targetType === "agent"
        ? agent?.name
        : targetType === "project"
          ? project?.name
          : undefined) ??
      faker.commerce.productName()
    return {
      id: params.id ?? faker.string.uuid(),
      targetType,
      targetId: resolvedTargetId,
      organizationId:
        params.organizationId ?? organization?.id ?? project?.organizationId ?? faker.string.uuid(),
      projectId: params.projectId ?? project?.id ?? faker.string.uuid(),
      invitedEmail: params.invitedEmail ?? faker.internet.email().toLowerCase(),
      role: params.role ?? "member",
      invitationToken: params.invitationToken ?? faker.string.uuid(),
      invitedAt: params.invitedAt ?? faker.date.recent().getTime(),
      organizationName: params.organizationName ?? organization?.name ?? faker.company.name(),
      projectName: params.projectName ?? project?.name ?? faker.commerce.productName(),
      targetName: resolvedTargetName,
    } satisfies PendingInvitationItem
  },
)
