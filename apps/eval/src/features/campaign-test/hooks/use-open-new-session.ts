import type { ReviewCampaignParamsDto } from "@bayes-platform/eval-contracts"
import { useLingui } from "@lingui/react/macro"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { useStartSession } from "../api/mutations"

/** Starts a session with the campaign's agent and opens it, from the page or from the sidebar. */
export function useOpenNewSession(campaign: ReviewCampaignParamsDto) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const startSession = useStartSession(campaign)
  return {
    isPending: startSession.isPending,
    open: () =>
      startSession.mutate(undefined, {
        onSuccess: (session) =>
          void navigate({
            to: "/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test/sessions/$sessionId",
            params: { ...campaign, sessionId: session.id },
          }),
        onError: () => toast.error(t`The session could not start. Try again.`),
      }),
  }
}
