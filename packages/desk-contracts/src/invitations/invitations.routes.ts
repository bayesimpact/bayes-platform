import { defineSchemaRoute } from "@caseai-connect/schema-route"
import {
  invitationAnswerOutputSchema,
  invitationParamsSchema,
  myInvitationsOutputSchema,
} from "./invitations.dto"

/** The signed-in person's own invitations, which they accept or decline. */
export const DeskInvitationsRoutes = {
  getMine: defineSchemaRoute({
    method: "get",
    path: "desk/me/invitations",
    response: myInvitationsOutputSchema,
  }),
  acceptOne: defineSchemaRoute({
    method: "post",
    path: "desk/me/invitations/:invitationId/accept",
    params: invitationParamsSchema,
    response: invitationAnswerOutputSchema,
  }),
  declineOne: defineSchemaRoute({
    method: "post",
    path: "desk/me/invitations/:invitationId/decline",
    params: invitationParamsSchema,
    response: invitationAnswerOutputSchema,
  }),
}
