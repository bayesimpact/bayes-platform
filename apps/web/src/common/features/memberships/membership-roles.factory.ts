import type { MembershipRoleDto, RoleScopeTypeDto } from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"

const KEY_PREFIX: Record<Exclude<RoleScopeTypeDto, "global">, string> = {
  organization: "org",
  project: "project",
  agent: "agent",
  review_campaign: "review_campaign",
}

const SCOPE_LABEL: Record<Exclude<RoleScopeTypeDto, "global">, string> = {
  organization: "Org",
  project: "Project",
  agent: "Agent",
  review_campaign: "Review Campaign",
}

/** A catalog role as the API returns it, from its scope and shorthand (`project` + `admin`). */
export function buildMembershipRoleDto({
  scopeType,
  role,
  membershipId,
}: {
  scopeType: Exclude<RoleScopeTypeDto, "global">
  role: "owner" | "admin" | "member" | "tester" | "reviewer"
  membershipId?: string
}): MembershipRoleDto {
  return {
    membershipId: membershipId ?? faker.string.uuid(),
    key: `${KEY_PREFIX[scopeType]}_${role}`,
    name: `${SCOPE_LABEL[scopeType]} ${role.charAt(0).toUpperCase()}${role.slice(1)}`,
    scopeType,
  }
}
