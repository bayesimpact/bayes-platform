import type { ReviewCampaignParamsDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { RatedFeedbackForm } from "@/components/shared/RatedFeedbackForm"
import { SectionCard } from "@/components/shared/SectionCard"
import { ParticipantCampaignFrame, useCampaignContext } from "@/features/campaign-context"
import { useSaveSurvey } from "../api/mutations"
import { testerSurveyQueryOptions } from "../api/queries"

export type TesterSurveyPageProps = {
  campaign: ReviewCampaignParamsDto
}

/** A campaign's Final survey tab: the survey a tester fills when they finish taking part, and can change while the campaign runs. */
export function TesterSurveyPage({ campaign }: TesterSurveyPageProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const context = useCampaignContext(campaign)
  const { data: survey } = useSuspenseQuery(testerSurveyQueryOptions(campaign))
  const saveSurvey = useSaveSurvey(campaign, survey !== null)
  return (
    <ParticipantCampaignFrame campaign={campaign} campaignRole="tester" currentTab="survey">
      <p className="text-muted-foreground">
        <Trans>Share your overall experience, so the team can evaluate this agent.</Trans>
      </p>
      <SectionCard title={context.agent.name}>
        <RatedFeedbackForm
          questions={context.testerEndOfPhaseQuestions}
          feedback={survey}
          ratingLabel={<Trans>Overall rating</Trans>}
          commentPlaceholder={t`What went well? What could be better?`}
          submitLabel={survey ? <Trans>Save changes</Trans> : <Trans>Submit survey</Trans>}
          isPending={saveSurvey.isPending}
          onSubmit={(input) =>
            saveSurvey.mutate(input, {
              onSuccess: () => {
                toast.success(t`Your survey was saved.`)
                void navigate({
                  to: "/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test",
                  params: campaign,
                })
              },
              onError: () => toast.error(t`Your survey could not be saved. Try again.`),
            })
          }
        />
      </SectionCard>
    </ParticipantCampaignFrame>
  )
}
