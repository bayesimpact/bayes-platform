import { type InvitationOutputDto, invitationOutputSchema } from "@caseai-connect/desk-contracts"
import { daysAgo } from "./agent-sessions.factory"

/** A pending invitation the person received, to an agent by default, checked against the contract. */
export function buildInvitation(overrides: Partial<InvitationOutputDto> = {}): InvitationOutputDto {
  return invitationOutputSchema.parse({
    id: crypto.randomUUID(),
    organizationName: "Product",
    projectName: "Support",
    targetType: "agent",
    targetName: "Helpful Assistant",
    role: "member",
    status: "pending",
    invitedAt: daysAgo(1),
    ...overrides,
  })
}
