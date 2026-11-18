import type { AgentParamsDto, ReviewCampaignParamsDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { BackLink } from "@/components/shared/BackLink"
import { CampaignStatusBadge } from "@/components/shared/CampaignStatusBadge"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { EvaluationAgent } from "@/features/agents"
import { campaignQueryOptions } from "../api/queries"
import { CAMPAIGN_TABS, type CampaignTab } from "../schemas"
import { CampaignStatusActions } from "./CampaignStatusActions"

/** A tab of a campaign's page: one of the editor's, or the report, which has a URL of its own. */
type CampaignPageTab = CampaignTab | "report"

export type CampaignPageFrameProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  campaignParams: ReviewCampaignParamsDto
  /** The open tab, for a campaign shown in tabs. */
  currentTab?: CampaignPageTab
  /** The steps of a draft's setup, shown in place of the tabs. */
  steps?: ReactNode
  /** Whether the setup has changes that are not saved: activating would leave them out. */
  hasUnsavedChanges: boolean
  /** What acts on the open tab, on the right of the tabs: the setup's preview, the report's download. */
  tabActions?: ReactNode
  /** The open tab's content, in `TabsContent`. */
  children: ReactNode
}

const isCampaignTab = (value: unknown): value is CampaignTab =>
  CAMPAIGN_TABS.some((tab) => tab === value)

/**
 * The frame of a campaign's pages, for who manages it: its name and status, what moves it on, and
 * its tabs, or the steps of a draft's setup. The report is a tab too, though it has its own URL: it opens once the campaign is
 * active.
 */
export function CampaignPageFrame({
  agent,
  agentParams,
  campaignParams,
  currentTab,
  steps,
  hasUnsavedChanges,
  tabActions,
  children,
}: CampaignPageFrameProps) {
  const navigate = useNavigate()
  const { data: campaign } = useSuspenseQuery(campaignQueryOptions(campaignParams))
  const campaignPathParams = { ...agentParams, reviewCampaignId: campaign.id }
  const handleTabChange = (value: unknown) => {
    if (value === "report") {
      void navigate({
        to: "/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/$reviewCampaignId/report",
        params: campaignPathParams,
      })
    } else if (isCampaignTab(value)) {
      void navigate({
        to: "/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/$reviewCampaignId",
        params: campaignPathParams,
        search: { tab: value },
      })
    }
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
        title={campaign.name}
        badge={<CampaignStatusBadge status={campaign.status} />}
        description={campaign.description}
        actions={
          <CampaignStatusActions
            agent={agent}
            campaign={campaign}
            campaignParams={campaignParams}
            hasUnsavedChanges={hasUnsavedChanges}
            // The setup's steps end on the activation: the bar keeps only the other actions.
            showsActivate={steps === undefined}
          />
        }
      />
      {steps ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {steps}
            {tabActions ? <div className="flex items-center gap-2">{tabActions}</div> : null}
          </div>
          {children}
        </>
      ) : (
        <Tabs value={currentTab} onValueChange={handleTabChange}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="setup">
                <Trans comment="The tab with a campaign's name and questions">Setup</Trans>
              </TabsTrigger>
              <TabsTrigger value="participants">
                <Trans>Participants</Trans>
              </TabsTrigger>
              {campaign.status === "closed" ? (
                <TabsTrigger value="summary">
                  <Trans comment="The tab with the first figures of a closed campaign">
                    Summary
                  </Trans>
                </TabsTrigger>
              ) : null}
              {campaign.status === "draft" ? null : (
                <TabsTrigger value="report">
                  <Trans comment="The tab with the full report of a campaign">Report</Trans>
                </TabsTrigger>
              )}
            </TabsList>
            {tabActions ? <div className="flex items-center gap-2">{tabActions}</div> : null}
          </div>
          {children}
        </Tabs>
      )}
    </PageContainer>
  )
}
