import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trans, useLingui } from "@lingui/react/macro"
import { useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { BackLink } from "@/components/shared/BackLink"
import { HeaderActions } from "@/components/shared/HeaderActions"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import { SidePanelToggle } from "@/components/shared/SidePanelToggle"
import { SplitPage } from "@/components/shared/SplitPage"
import type { EvaluationAgent } from "@/features/agents"
import { useSidePanel } from "@/hooks/use-side-panel"
import { ApiError } from "@/lib/api-client"
import { useCreateCampaign } from "../api/mutations"
import { campaignConfigInputOf } from "../campaign-form"
import { type CampaignFormValues, campaignFormSchema } from "../schemas"
import { CampaignSetupForm } from "./CampaignSetupForm"
import { FeedbackPreview } from "./FeedbackPreview"

export type NewCampaignPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  /** The setup a new campaign starts from, in the person's language. */
  defaultValues: CampaignFormValues
}

/** Tailwind's `xl`, from which the setup and the preview panel both have room. */
const ROOMY_QUERY = "(min-width: 80rem)"

/**
 * Creates a campaign for an agent, as a draft, then opens it. The preview of its forms shows in a
 * panel beside the setup.
 */
export function NewCampaignPage({ agent, agentParams, defaultValues }: NewCampaignPageProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const previewPanel = useSidePanel(ROOMY_QUERY)
  const createCampaign = useCreateCampaign(agentParams)
  const form = useForm({ resolver: zodResolver(campaignFormSchema), defaultValues })

  const handleSubmit = (values: CampaignFormValues) =>
    createCampaign.mutate(
      { agentId: agent.id, ...campaignConfigInputOf(values) },
      {
        onSuccess: (campaign) => {
          toast.success(t`The campaign was created. Activate it to invite its participants.`)
          void navigate({
            to: "/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/$reviewCampaignId",
            params: { ...agentParams, reviewCampaignId: campaign.id },
          })
        },
        onError: (error) =>
          // The API refuses an agent that was never published, and says so.
          toast.error(
            error instanceof ApiError && error.status === 422
              ? t`This agent has no published version yet. Publish it, then create the campaign.`
              : t`The campaign could not be created. Try again.`,
          ),
      },
    )

  return (
    <SplitPage
      panel={
        previewPanel.isOpen ? (
          <FeedbackPreview
            control={form.control}
            onClose={previewPanel.close}
            takesFocus={previewPanel.takesFocus}
          />
        ) : null
      }
    >
      <HeaderActions>
        <SidePanelToggle isOpen={previewPanel.isOpen} onToggle={previewPanel.toggle}>
          <Trans comment="The button that shows the forms testers and reviewers will fill">
            Preview
          </Trans>
        </SidePanelToggle>
      </HeaderActions>
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
              Set the questions up, then activate the campaign to invite its participants.
            </Trans>
          }
        />
        <CampaignSetupForm
          form={form}
          agentName={agent.name}
          isLocked={false}
          submitLabel={<Trans>Create the campaign</Trans>}
          isPending={createCampaign.isPending}
          onSubmit={handleSubmit}
        />
      </PageContainer>
    </SplitPage>
  )
}
