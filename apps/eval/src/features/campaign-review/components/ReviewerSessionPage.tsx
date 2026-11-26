import type { CampaignSessionParamsDto } from "@caseai-connect/eval-contracts"
import { fullDateTimeOf } from "@caseai-connect/frontend-lib"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { BackLink } from "@/components/shared/BackLink"
import { HeaderActions } from "@/components/shared/HeaderActions"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import { SidePanel } from "@/components/shared/SidePanel"
import { SidePanelToggle } from "@/components/shared/SidePanelToggle"
import { SplitPage } from "@/components/shared/SplitPage"
import { useCampaignContext } from "@/features/campaign-context"
import { useSidePanel } from "@/hooks/use-side-panel"
import { shortIdOf } from "@/lib/short-id"
import { reviewerSessionQueryOptions } from "../api/queries"
import { FormResultPanel } from "./FormResultPanel"
import { OtherReviews } from "./OtherReviews"
import { ReviewPanel } from "./ReviewPanel"
import { SessionTranscript } from "./SessionTranscript"
import { TesterFeedbackPanel } from "./TesterFeedbackPanel"

export type ReviewerSessionPageProps = {
  sessionParams: CampaignSessionParamsDto
}

/**
 * A tester's session, for a reviewer, in two parts: what was said on the left, and on the right a
 * panel with the reviewer's own review and what the tester reported. The tester's opinion and the
 * other reviews show after they submit.
 */
export function ReviewerSessionPage({ sessionParams }: ReviewerSessionPageProps) {
  const { i18n } = useLingui()
  const context = useCampaignContext(sessionParams)
  const { data: session } = useSuspenseQuery(reviewerSessionQueryOptions(sessionParams))
  const panel = useSidePanel()
  const sessionId = shortIdOf(session.sessionId)
  const testerId = shortIdOf(session.testerUserId)
  const started = fullDateTimeOf(session.startedAt, i18n.locale)
  return (
    <SplitPage
      panel={
        panel.isOpen ? (
          <SidePanel
            title={<Trans>Session review</Trans>}
            onClose={panel.close}
            takesFocus={panel.takesFocus}
          >
            <div className="flex flex-col gap-4">
              {/* What the tester reported comes first: the reviewer reads it before judging. */}
              <TesterFeedbackPanel session={session} />
              <ReviewPanel
                sessionParams={sessionParams}
                session={session}
                isOpen={context.status === "active"}
              />
              {session.formResult ? <FormResultPanel formResult={session.formResult} /> : null}
              {session.blind ? null : (
                <OtherReviews
                  reviews={session.otherReviews}
                  questions={session.reviewerQuestions}
                />
              )}
            </div>
          </SidePanel>
        ) : null
      }
    >
      <HeaderActions>
        {/* The review is the page's task: its panel's button takes the primary color. */}
        <SidePanelToggle isOpen={panel.isOpen} onToggle={panel.toggle} isPrimary>
          <Trans>Session review</Trans>
        </SidePanelToggle>
      </HeaderActions>
      <PageContainer isNarrow>
        <PageHeader
          back={
            <BackLink
              to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review"
              params={sessionParams}
            >
              {context.name}
            </BackLink>
          }
          title={
            <Trans comment="The title of a session's page, with the start of its id">
              Session <span className="font-mono">{sessionId}</span>
            </Trans>
          }
          description={
            <Trans comment="Who started a session, by the start of their id, and when">
              Tester {testerId}, started {started}
            </Trans>
          }
        />
        <SessionTranscript
          messages={session.transcript}
          session={sessionParams}
          conversation={{
            organizationId: sessionParams.organizationId,
            projectId: sessionParams.projectId,
            agentId: session.agent.id,
            agentSessionId: sessionParams.sessionId,
          }}
        />
      </PageContainer>
    </SplitPage>
  )
}
