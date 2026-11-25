import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { AddMemberRoleRequestDto } from "../project-membership/project-membership.dto"

/**
 * Evaluation serves its own campaign routes under `eval/`. Only the two routes of the Studio's
 * member page are left here.
 */
export const ReviewCampaignsRoutes = {
  revokeMembership: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId/memberships/:membershipId",
  }),
  /**
   * Gives a member of the workspace a tester or reviewer role on the campaign, without an
   * invitation. Needs `project.review_campaign.member.invite`. Nobody changes their own roles,
   * and a closed campaign takes no new role.
   */
  addMemberRole: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<AddMemberRoleRequestDto>
  >({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/review-campaigns/:reviewCampaignId/users/:userId/roles",
  }),
}
