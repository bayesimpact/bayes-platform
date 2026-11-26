import type { InvitationStatusDto, InvitationTargetTypeDto } from "@bayes-platform/api-contracts"

export type InvitationTargetType = InvitationTargetTypeDto

export type InvitationStatus = InvitationStatusDto

export function isInvitationTargetType(value: string): value is InvitationTargetType {
  return value === "project" || value === "agent" || value === "review_campaign"
}
