import { Button } from "@caseai-connect/app-ui/components/button"
import type {
  ReviewCampaignParamsDto,
  TesterSessionOutputDto,
} from "@caseai-connect/eval-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQueries } from "@tanstack/react-query"
import { ArrowRightIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { SectionCard } from "@/components/shared/SectionCard"
import { ParticipantCampaignFrame, useCampaignContext } from "@/features/campaign-context"
import { useDeleteSession } from "../api/mutations"
import { testerSessionsQueryOptions, testerSurveyQueryOptions } from "../api/queries"
import { useOpenNewSession } from "../hooks/use-open-new-session"
import { SessionFeedbackDialog } from "./SessionFeedbackDialog"
import { SurveyCard } from "./SurveyCard"
import { TesterSessionsTable } from "./TesterSessionsTable"

export type TesterCampaignPageProps = {
  campaign: ReviewCampaignParamsDto
}

/**
 * A campaign for one of its testers: start a session with the agent, give feedback on the
 * sessions they started, and fill the final survey.
 */
export function TesterCampaignPage({ campaign }: TesterCampaignPageProps) {
  const { t } = useLingui()
  const context = useCampaignContext(campaign)
  const [{ data: sessions }, { data: survey }] = useSuspenseQueries({
    queries: [testerSessionsQueryOptions(campaign), testerSurveyQueryOptions(campaign)],
  })
  const [feedbackSessionId, setFeedbackSessionId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<TesterSessionOutputDto | null>(null)
  const newSession = useOpenNewSession(campaign)
  const deleteSession = useDeleteSession(campaign)
  const sessionCount = sessions.length
  const hasGivenFeedback = sessions.some((session) => session.feedbackStatus === "submitted")

  return (
    <ParticipantCampaignFrame
      campaign={campaign}
      campaignRole="tester"
      currentTab="overview"
      canOpenSurvey={hasGivenFeedback}
    >
      {/* The table has its own frame: the block of the sessions needs none around it. */}
      <SectionCard
        className="rounded-none border-0 bg-transparent p-0 md:p-0 dark:bg-transparent"
        title={<Trans>Your sessions</Trans>}
        description={<Plural value={sessionCount} one="# session" other="# sessions" />}
        aside={
          <Button onClick={newSession.open} disabled={newSession.isPending}>
            <Trans>Start a session</Trans>
            <ArrowRightIcon data-icon="inline-end" aria-hidden />
          </Button>
        }
      >
        <TesterSessionsTable
          campaign={campaign}
          sessions={sessions}
          onGiveFeedback={(target) => setFeedbackSessionId(target.id)}
          onDelete={setDeleting}
        />
      </SectionCard>
      {/* The final survey comes once the tester gave feedback on at least one session. */}
      {hasGivenFeedback ? <SurveyCard campaign={campaign} hasSurvey={survey !== null} /> : null}
      <SessionFeedbackDialog
        campaign={campaign}
        context={context}
        sessionId={feedbackSessionId}
        onClose={() => setFeedbackSessionId(null)}
      />
      <ConfirmDialog
        isOpen={deleting !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeleting(null)
        }}
        title={<Trans>Delete this session?</Trans>}
        description={<Trans>The session and its messages are deleted for good.</Trans>}
        confirmLabel={<Trans>Delete</Trans>}
        isDestructive
        isPending={deleteSession.isPending}
        onConfirm={() => {
          if (!deleting) return
          deleteSession.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
            onError: () => toast.error(t`The session could not be deleted. Try again.`),
          })
        }}
      />
    </ParticipantCampaignFrame>
  )
}
