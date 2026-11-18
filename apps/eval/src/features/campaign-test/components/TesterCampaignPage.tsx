import type {
  ReviewCampaignParamsDto,
  TesterSessionOutputDto,
} from "@caseai-connect/eval-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQueries } from "@tanstack/react-query"
import { ArrowRightIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { CampaignStatusBadge } from "@/components/shared/CampaignStatusBadge"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import { CampaignAgentCard, useCampaignContext } from "@/features/campaign-context"
import { useDeleteSession } from "../api/mutations"
import { testerSessionsQueryOptions, testerSurveyQueryOptions } from "../api/queries"
import { useOpenNewSession } from "../hooks/use-open-new-session"
import { SessionFeedbackDialog } from "./SessionFeedbackDialog"
import { SurveyCard } from "./SurveyCard"
import { TesterSessionRow } from "./TesterSessionRow"

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

  return (
    <PageContainer>
      <PageHeader
        title={context.name}
        badge={<CampaignStatusBadge status={context.status} />}
        description={context.description}
      />
      <CampaignAgentCard
        agent={context.agent}
        action={
          <Button onClick={newSession.open} disabled={newSession.isPending}>
            <Trans>Start a conversation</Trans>
            <ArrowRightIcon data-icon="inline-end" aria-hidden />
          </Button>
        }
      />
      <SectionCard
        title={<Trans>Your sessions</Trans>}
        aside={<Plural value={sessionCount} one="# session" other="# sessions" />}
      >
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            <Trans>
              You have not started a session yet. Your sessions show here, with the feedback you
              gave on each.
            </Trans>
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((session) => (
              <TesterSessionRow
                key={session.id}
                campaign={campaign}
                session={session}
                onGiveFeedback={(target) => setFeedbackSessionId(target.id)}
                onDelete={setDeleting}
              />
            ))}
          </ul>
        )}
      </SectionCard>
      <SurveyCard campaign={campaign} hasSurvey={survey !== null} />
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
    </PageContainer>
  )
}
