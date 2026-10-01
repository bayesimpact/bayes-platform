import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { PendingInvitation } from "./invitations.models"

export const pendingInvitationFactory = Factory.define<PendingInvitation>(({ params }) => {
  const targetType = params.targetType ?? "project"
  const projectId = params.projectId ?? faker.string.uuid()
  const projectName = params.projectName ?? "Product"
  return {
    id: params.id ?? faker.string.uuid(),
    targetType,
    targetId: params.targetId ?? (targetType === "project" ? projectId : faker.string.uuid()),
    organizationId: params.organizationId ?? faker.string.uuid(),
    projectId,
    invitedEmail: params.invitedEmail ?? faker.internet.email().toLowerCase(),
    role: params.role ?? (targetType === "project" ? "admin" : "member"),
    invitedAt: params.invitedAt ?? faker.date.recent().getTime(),
    organizationName: params.organizationName ?? faker.company.name(),
    projectName,
    targetName: params.targetName ?? (targetType === "project" ? projectName : "Helpful Assistant"),
  }
})
