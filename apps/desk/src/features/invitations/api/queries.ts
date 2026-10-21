import { DeskInvitationsRoutes } from "@caseai-connect/desk-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { invitationKeys } from "./keys"

/** An invitation arrives while the Desk is open: the list asks for it this often. */
const REFRESH_INTERVAL_IN_MILLISECONDS = 60 * 1000

/** The signed-in person's pending invitations, newest first. */
export const myInvitationsQueryOptions = () =>
  queryOptions({
    queryKey: invitationKeys.mine(),
    queryFn: async ({ signal }) => {
      const { invitations } = await apiRequest(DeskInvitationsRoutes.getMine, { signal })
      return invitations
        .filter((invitation) => invitation.status === "pending")
        .sort((first, second) => second.invitedAt - first.invitedAt)
    },
    refetchInterval: REFRESH_INTERVAL_IN_MILLISECONDS,
  })
