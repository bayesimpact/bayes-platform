import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  CreateInvitationsRequestDto,
  CreateInvitationsResponseDto,
  CreateReviewCampaignInvitationsRequestDto,
  ListInvitationsResponseDto,
} from "./invitations.dto"

const PROJECT_PATH = "organizations/:organizationId/projects/:projectId"

/** Invitations to a project. Needs `project.member.invite` on the project. */
export const ProjectInvitationsRoutes = {
  getAll: defineRoute<ResponseData<ListInvitationsResponseDto>>({
    method: "get",
    path: `${PROJECT_PATH}/invitations`,
  }),
  createMany: defineRoute<
    ResponseData<CreateInvitationsResponseDto>,
    RequestPayload<CreateInvitationsRequestDto>
  >({
    method: "post",
    path: `${PROJECT_PATH}/invitations`,
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: `${PROJECT_PATH}/invitations/:invitationId`,
  }),
}

/** Invitations to an agent. Needs `agent.member.invite` on the agent. */
export const AgentInvitationsRoutes = {
  getAll: defineRoute<ResponseData<ListInvitationsResponseDto>>({
    method: "get",
    path: `${PROJECT_PATH}/agents/:agentId/invitations`,
  }),
  createMany: defineRoute<
    ResponseData<CreateInvitationsResponseDto>,
    RequestPayload<CreateInvitationsRequestDto>
  >({
    method: "post",
    path: `${PROJECT_PATH}/agents/:agentId/invitations`,
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: `${PROJECT_PATH}/agents/:agentId/invitations/:invitationId`,
  }),
}

/**
 * Invitations to a review campaign. Needs `project.review_campaign.member.invite` on its
 * project.
 */
export const ReviewCampaignInvitationsRoutes = {
  getAll: defineRoute<ResponseData<ListInvitationsResponseDto>>({
    method: "get",
    path: `${PROJECT_PATH}/review-campaigns/:reviewCampaignId/invitations`,
  }),
  createMany: defineRoute<
    ResponseData<CreateInvitationsResponseDto>,
    RequestPayload<CreateReviewCampaignInvitationsRequestDto>
  >({
    method: "post",
    path: `${PROJECT_PATH}/review-campaigns/:reviewCampaignId/invitations`,
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: `${PROJECT_PATH}/review-campaigns/:reviewCampaignId/invitations/:invitationId`,
  }),
}

/** The signed-in person's own pending invitations. */
export const MyInvitationsRoutes = {
  getAll: defineRoute<ResponseData<ListInvitationsResponseDto>>({
    method: "get",
    path: "me/invitations",
  }),
  acceptOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "post",
    path: "me/invitations/:invitationId/accept",
  }),
  declineOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "post",
    path: "me/invitations/:invitationId/decline",
  }),
}
