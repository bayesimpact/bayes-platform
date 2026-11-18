import {
  type AgentParamsDto,
  PROJECT_REVIEW_CAMPAIGN_UPDATE_PERMISSION,
  type ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { SidePanelToggle } from "@/components/shared/SidePanelToggle"
import { SplitPage } from "@/components/shared/SplitPage"
import { TabsContent } from "@/components/ui/tabs"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useUpdateCampaign } from "../api/mutations"
import { campaignQueryOptions } from "../api/queries"
import { campaignConfigInputOf, campaignFormValuesOf } from "../campaign-form"
import { type CampaignTab, campaignFormSchema } from "../schemas"
import { CampaignPageFrame } from "./CampaignPageFrame"
import { CampaignSetupForm } from "./CampaignSetupForm"
import { CampaignSummary } from "./CampaignSummary"
import { FeedbackPreview } from "./FeedbackPreview"
import { ParticipantsPanel } from "./ParticipantsPanel"

export type CampaignEditorProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  campaignParams: ReviewCampaignParamsDto
  /** The tab the URL names, or none for the campaign's first one. */
  tab: CampaignTab | undefined
  /** Whether the URL opens or closes the preview panel, or none for what the window has room for. */
  preview: boolean | undefined
}

/** Tailwind's `xl`, from which the setup and the preview panel both have room. */
const ROOMY_QUERY = "(min-width: 80rem)"

/**
 * A campaign, for who manages it: its setup while it is a draft, with the preview of its forms in
 * a panel beside it, its participants once active, its summary once closed, and what moves it from
 * one status to the next.
 */
export function CampaignEditor({
  agent,
  agentParams,
  campaignParams,
  tab,
  preview,
}: CampaignEditorProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const { data: campaign } = useSuspenseQuery(campaignQueryOptions(campaignParams))
  const updateCampaign = useUpdateCampaign(campaignParams)
  const form = useForm({
    resolver: zodResolver(campaignFormSchema),
    // The form follows the campaign as the API returns it, after each save.
    values: campaignFormValuesOf(campaign),
  })
  const canUpdate = hasProjectPermission(agent.project, PROJECT_REVIEW_CAMPAIGN_UPDATE_PERMISSION)
  const isLocked = campaign.status !== "draft" || !canUpdate
  // A closed campaign opens on its figures, an active one on its people, a draft on its setup.
  const defaultTab: CampaignTab =
    campaign.status === "closed"
      ? "summary"
      : campaign.status === "active"
        ? "participants"
        : "setup"
  const currentTab = tab ?? defaultTab
  const hasRoom = useMediaQuery(ROOMY_QUERY)
  // The preview goes with the setup: it shows from the start where both have room.
  const isPreviewOpen = currentTab === "setup" && (preview ?? hasRoom)

  return (
    <SplitPage
      panel={
        isPreviewOpen ? (
          <FeedbackPreview
            control={form.control}
            onClose={() => void navigate({ to: ".", search: { tab, preview: false } })}
            takesFocus={preview === true}
          />
        ) : null
      }
    >
      <CampaignPageFrame
        agent={agent}
        agentParams={agentParams}
        campaignParams={campaignParams}
        currentTab={currentTab}
        hasUnsavedChanges={form.formState.isDirty}
        tabActions={
          currentTab === "setup" ? (
            <SidePanelToggle
              isOpen={isPreviewOpen}
              onToggle={() => void navigate({ to: ".", search: { tab, preview: !isPreviewOpen } })}
            >
              <Trans comment="The button that shows the forms testers and reviewers will fill">
                Preview
              </Trans>
            </SidePanelToggle>
          ) : null
        }
      >
        <TabsContent value="setup" className="pt-4">
          <CampaignSetupForm
            form={form}
            agentName={agent.name}
            isLocked={isLocked}
            submitLabel={<Trans>Save</Trans>}
            isPending={updateCampaign.isPending}
            onSubmit={(values) =>
              updateCampaign.mutate(campaignConfigInputOf(values), {
                onSuccess: () => toast.success(t`The campaign was saved.`),
                onError: () => toast.error(t`The campaign could not be saved. Try again.`),
              })
            }
          />
        </TabsContent>
        <TabsContent value="participants" className="pt-4">
          <ParticipantsPanel agent={agent} campaign={campaign} campaignParams={campaignParams} />
        </TabsContent>
        <TabsContent value="summary" className="pt-4">
          <CampaignSummary aggregates={campaign.aggregates} />
        </TabsContent>
      </CampaignPageFrame>
    </SplitPage>
  )
}
