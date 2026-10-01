import type { MemberGrantTargetTypeDto } from "@caseai-connect/api-contracts"

export type MemberGrantTargetType = MemberGrantTargetTypeDto

export function isMemberGrantTargetType(value: string): value is MemberGrantTargetType {
  return value === "project" || value === "agent" || value === "review_campaign"
}
