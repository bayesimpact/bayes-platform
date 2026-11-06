import { DeskInvitationsRoutes } from "@caseai-connect/desk-contracts"
import { useLingui } from "@lingui/react/macro"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { toast } from "sonner"
import { refreshDeskAgents } from "@/features/agents"
import { apiRequest } from "@/lib/api-client"
import { myInvitationsQueryOptions } from "./queries"

/** What the person answers to an invitation. */
export type InvitationAnswer = "accept" | "decline"

type Answer = { invitationId: string; targetName: string; answer: InvitationAnswer }

/**
 * Accepts or declines an invitation, and says so. An accepted one gives access to a project or an
 * agent: the Desk loads the person's agents again, and the page reloads its data, so the home of
 * a person without an agent opens the one they just joined.
 */
export function useAnswerInvitation() {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: ({ invitationId, answer }: Answer) =>
      apiRequest(
        answer === "accept" ? DeskInvitationsRoutes.acceptOne : DeskInvitationsRoutes.declineOne,
        { params: { invitationId } },
      ),
    // The toasts come from the hook: the page an accepted invitation opens unmounts the envelope.
    onSuccess: (_, { answer, targetName }) => {
      if (answer === "accept") toast.success(t`You joined ${targetName}.`)
      else toast(t`You declined the invitation to ${targetName}.`)
    },
    onError: () => toast.error(t`The invitation could not be answered. Try again.`),
    onSettled: async (_, __, { answer }) => {
      await queryClient.invalidateQueries({ queryKey: myInvitationsQueryOptions().queryKey })
      if (answer === "decline") return
      await refreshDeskAgents(queryClient)
      await router.invalidate()
    },
  })
}
