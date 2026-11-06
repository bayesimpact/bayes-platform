import type { EntityManager } from "typeorm"
import { REVIEW_CAMPAIGN_ROLES } from "./rbac.constants"
import { requireRoleId } from "./resolve-role-id"

export async function resolveReviewCampaignRoleId(
  manager: EntityManager,
  role: keyof typeof REVIEW_CAMPAIGN_ROLES,
): Promise<string> {
  // The role comes from a varchar column (invitation.role). An unknown value must not reach
  // findOne: TypeORM drops an undefined where value and would return an arbitrary role.
  if (!Object.hasOwn(REVIEW_CAMPAIGN_ROLES, role)) {
    throw new Error(`Unknown review campaign role: ${role}`)
  }
  return requireRoleId(manager, REVIEW_CAMPAIGN_ROLES[role])
}
