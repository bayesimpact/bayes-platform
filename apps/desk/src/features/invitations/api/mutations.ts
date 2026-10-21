import { DeskInvitationsRoutes } from "@caseai-connect/desk-contracts"
import { useLingui } from "@lingui/react/macro"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { toast } from "sonner"
import { refreshDeskAgents } from "@/features/agents"
import { apiRequest } from "@/lib/api-client"
import { invitationKeys } from "./keys"

type Answer = { invitationId: string; targetName: string; answer: "accept" | "decline" }

/**
 * Accepts or declines an invitation, and says so. An accepted one gives access to a project or an
 * agent: the Desk loads the person's agents again, and the page reloads its data, so the home of
 * a person without an agent opens the one they just joined. The toasts come from the hook, which
 * outlives the envelope that page then replaces.
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
    onSuccess: async (_, { answer, targetName }) => {
      if (answer === "decline") {
        toast(t`You declined the invitation to ${targetName}.`)
        return
      }
      toast.success(t`You joined ${targetName}.`)
      await refreshDeskAgents(queryClient)
      await router.invalidate()
    },
    onError: () => toast.error(t`The invitation could not be answered. Try again.`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: invitationKeys.mine() }),
  })
}
