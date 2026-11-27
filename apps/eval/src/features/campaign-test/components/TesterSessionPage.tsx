import { Button } from "@caseai-connect/app-ui/components/button"
import type { CampaignSessionParamsDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { CheckIcon, EyeIcon } from "lucide-react"
import { useState } from "react"
import { BackLink } from "@/components/shared/BackLink"
import { HeaderBack } from "@/components/shared/HeaderBack"
import { useCampaignContext } from "@/features/campaign-context"
import { ConversationView } from "@/features/conversation"
import { testerSessionsQueryOptions } from "../api/queries"
import { SessionFeedbackPanel } from "./SessionFeedbackPanel"

export type TesterSessionPageProps = {
  sessionParams: CampaignSessionParamsDto
}

/**
 * A tester's session: the conversation with the campaign's agent, and the way to end it with their
 * feedback, in a panel beside the conversation. A session whose feedback is given stays readable.
 */
export function TesterSessionPage({ sessionParams }: TesterSessionPageProps) {
  const navigate = useNavigate()
  const context = useCampaignContext(sessionParams)
  const { data: sessions } = useSuspenseQuery(testerSessionsQueryOptions(sessionParams))
  const [isGivingFeedback, setIsGivingFeedback] = useState(false)
  const session = sessions.find((candidate) => candidate.id === sessionParams.sessionId)
  const canGiveFeedback = session?.feedbackStatus === "pending"
  const conversation = {
    organizationId: sessionParams.organizationId,
    projectId: sessionParams.projectId,
    agentId: context.agent.id,
    agentSessionId: sessionParams.sessionId,
  }

  return (
    <>
      {/* The way back to the campaign's sessions, at the start of the bar above the page. */}
      <HeaderBack>
        <BackLink
          to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test"
          params={sessionParams}
        >
          <Trans comment="The link back to the campaign from one of its sessions">Back</Trans>
        </BackLink>
      </HeaderBack>
      {/* The tester knows who reads what they write here before they write it. Above the fade of
          the bar, which would otherwise wash it out. */}
      <div className="relative z-20 shrink-0 px-4 pt-2">
        <p className="mx-auto flex max-w-3xl items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-center text-sm text-foreground">
          <EyeIcon aria-hidden className="size-4 shrink-0 text-primary" />
          <Trans>
            The reviewers of this campaign can read everything exchanged in this session.
          </Trans>
        </p>
      </div>
      <ConversationView
        conversation={conversation}
        agentName={context.agent.name}
        // The agent cites sources only when its project has the `sources-tool` feature, which a
        // tester cannot read: a reply that carries sources shows them.
        hasSourcesTool
        forms={session?.forms ?? []}
        headerActions={
          canGiveFeedback ? (
            <Button
              size="sm"
              variant={isGivingFeedback ? "secondary" : "default"}
              aria-pressed={isGivingFeedback}
              onClick={() => setIsGivingFeedback((current) => !current)}
            >
              <CheckIcon data-icon="inline-start" aria-hidden />
              <Trans>End the session and give feedback</Trans>
            </Button>
          ) : null
        }
        sidePanel={
          canGiveFeedback && isGivingFeedback ? (
            <SessionFeedbackPanel
              sessionParams={sessionParams}
              context={context}
              onClose={() => setIsGivingFeedback(false)}
              onSubmitted={() =>
                void navigate({
                  to: "/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test",
                  params: sessionParams,
                })
              }
            />
          ) : null
        }
        onSidePanelDismiss={() => setIsGivingFeedback(false)}
      />
    </>
  )
}
