import {
  type AgentParamsDto,
  PROJECT_REVIEW_CAMPAIGN_UPDATE_PERMISSION,
  type ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import { BarChart3Icon } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { BackLink } from "@/components/shared/BackLink"
import { CampaignStatusBadge } from "@/components/shared/CampaignStatusBadge"
import { HeaderActions } from "@/components/shared/HeaderActions"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import { SidePanelToggle } from "@/components/shared/SidePanelToggle"
import { SplitPage } from "@/components/shared/SplitPage"
import { buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useUpdateCampaign } from "../api/mutations"
import { campaignQueryOptions } from "../api/queries"
import { campaignConfigInputOf, campaignFormValuesOf } from "../campaign-form"
import { CAMPAIGN_TABS, type CampaignTab, campaignFormSchema } from "../schemas"
import { CampaignSetupForm } from "./CampaignSetupForm"
import { CampaignStatusActions } from "./CampaignStatusActions"
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

const isCampaignTab = (value: unknown): value is CampaignTab =>
  CAMPAIGN_TABS.some((tab) => tab === value)

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
      {currentTab === "setup" ? (
        <HeaderActions>
          <SidePanelToggle
            isOpen={isPreviewOpen}
            onToggle={() => void navigate({ to: ".", search: { tab, preview: !isPreviewOpen } })}
          >
            <Trans comment="The button that shows the forms testers and reviewers will fill">
              Preview
            </Trans>
          </SidePanelToggle>
        </HeaderActions>
      ) : null}
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
          title={campaign.name}
          badge={<CampaignStatusBadge status={campaign.status} />}
          description={campaign.description}
          actions={
            <>
              {campaign.status === "draft" ? null : (
                <Link
                  to="/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/$reviewCampaignId/report"
                  params={{ ...agentParams, reviewCampaignId: campaign.id }}
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  <BarChart3Icon data-icon="inline-start" aria-hidden />
                  <Trans>Report</Trans>
                </Link>
              )}
              <CampaignStatusActions
                agent={agent}
                campaign={campaign}
                campaignParams={campaignParams}
                hasUnsavedChanges={form.formState.isDirty}
              />
            </>
          }
        />
        <Tabs
          value={currentTab}
          onValueChange={(value) => {
            if (isCampaignTab(value)) void navigate({ to: ".", search: { tab: value } })
          }}
        >
          <TabsList>
            <TabsTrigger value="setup">
              <Trans comment="The tab with a campaign's name and questions">Setup</Trans>
            </TabsTrigger>
            <TabsTrigger value="participants">
              <Trans>Participants</Trans>
            </TabsTrigger>
            {campaign.status === "closed" ? (
              <TabsTrigger value="summary">
                <Trans comment="The tab with the first figures of a closed campaign">Summary</Trans>
              </TabsTrigger>
            ) : null}
          </TabsList>
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
        </Tabs>
      </PageContainer>
    </SplitPage>
  )
}
