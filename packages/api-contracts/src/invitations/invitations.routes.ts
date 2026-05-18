import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  CreateInvitationsRequestDto,
  CreateInvitationsResponseDto,
  ListInvitationsResponseDto,
} from "./invitations.dto"

export const InvitationsRoutes = {
  createForTarget: defineRoute<
    ResponseData<CreateInvitationsResponseDto>,
    RequestPayload<CreateInvitationsRequestDto>
  >({
    method: "post",
    path: "invitations",
  }),
  acceptOne: defineRoute<ResponseData<SuccessResponseDTO>, RequestPayload<{ ticketId: string }>>({
    method: "post",
    path: "invitations/accept",
  }),
  revokeOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "invitations/:invitationId",
  }),
  listPendingMine: defineRoute<ResponseData<ListInvitationsResponseDto>>({
    method: "get",
    path: "invitations/mine",
  }),
  listForTarget: defineRoute<ResponseData<ListInvitationsResponseDto>>({
    method: "get",
    path: "invitations",
  }),
}
