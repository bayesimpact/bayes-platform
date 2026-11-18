import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trans, useLingui } from "@lingui/react/macro"
import { useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { BackLink } from "@/components/shared/BackLink"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import type { EvaluationAgent } from "@/features/agents"
import { ApiError } from "@/lib/api-client"
import { useCreateCampaign } from "../api/mutations"
import { campaignConfigInputOf } from "../campaign-form"
import { type CampaignFormValues, campaignFormSchema } from "../schemas"
import { SETUP_STEP_FIELDS } from "../setup-steps"
import { CampaignGeneralFields } from "./CampaignGeneralFields"
import { SetupStepFooter } from "./SetupStepFooter"
import { SetupStepper } from "./SetupStepper"

export type NewCampaignPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  /** The setup a new campaign starts from, in the person's language. */
  defaultValues: CampaignFormValues
}

/**
 * The first step of a new campaign: its name and what it is for. The next one creates it as a
 * draft, with the default questions, and opens its second step.
 */
export function NewCampaignPage({ agent, agentParams, defaultValues }: NewCampaignPageProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const createCampaign = useCreateCampaign(agentParams)
  const form = useForm({ resolver: zodResolver(campaignFormSchema), defaultValues })

  const handleNext = async () => {
    const isValid = await form.trigger([...SETUP_STEP_FIELDS.campaign])
    if (!isValid) return
    createCampaign.mutate(
      { agentId: agent.id, ...campaignConfigInputOf(form.getValues()) },
      {
        onSuccess: (campaign) =>
          void navigate({
            to: "/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/$reviewCampaignId",
            params: { ...agentParams, reviewCampaignId: campaign.id },
            search: { step: "session" },
          }),
        onError: (error) =>
          // The API refuses an agent that was never published, and says so.
          toast.error(
            error instanceof ApiError && error.status === 422
              ? t`This agent has no published version yet. Publish it, then create the campaign.`
              : t`The campaign could not be created. Try again.`,
          ),
      },
    )
  }

  return (
    <PageContainer>
      <PageHeader
        back={
          <BackLink
            to="/o/$organizationId/p/$projectId/a/$agentId/review-campaigns"
            params={agentParams}
          >
            <Trans>Campaigns</Trans>
          </BackLink>
        }
        title={<Trans>New review campaign</Trans>}
        description={
          <Trans>
            Name the campaign, choose what testers and reviewers answer, then activate it and invite
            them.
          </Trans>
        }
      />
      {/* The campaign does not exist yet: no other step opens before the first one is done. */}
      <SetupStepper currentStep="campaign" canOpen={() => false} onOpen={() => {}} />
      <CampaignGeneralFields form={form} agentName={agent.name} isLocked={false} />
      <SetupStepFooter onNext={() => void handleNext()} isPending={createCampaign.isPending} />
    </PageContainer>
  )
}
