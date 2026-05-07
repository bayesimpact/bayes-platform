import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { ListInvitationsResponseDto } from "./invitations.dto"

export const InvitationsRoutes = {
  acceptOne: defineRoute<ResponseData<SuccessResponseDTO>, RequestPayload<{ ticketId: string }>>({
    method: "post",
    path: "invitations/accept",
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
