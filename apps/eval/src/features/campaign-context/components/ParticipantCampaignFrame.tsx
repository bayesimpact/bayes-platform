import type { ReviewCampaignParamsDto } from "@bayes-platform/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useNavigate } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { CampaignDescription } from "@/components/shared/CampaignDescription"
import { CampaignStatusBadge } from "@/components/shared/CampaignStatusBadge"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEvaluationWorkspace } from "@/features/agents"
import { useCampaignContext } from "../hooks/use-campaign-context"
import { CampaignAgentCard } from "./CampaignAgentCard"

/** A tab of a campaign's pages for its participants: each has its own URL. */
type ParticipantCampaignTab = "overview" | "report" | "survey"

export type ParticipantCampaignFrameProps = {
  campaign: ReviewCampaignParamsDto
  /** What the person does in the campaign on this page, which sets its tabs. */
  campaignRole: "tester" | "reviewer"
  currentTab: ParticipantCampaignTab
  /** Whether a tester can open the final survey: once a session has their feedback. */
  canOpenSurvey?: boolean
  /** What acts on the open tab, on the right of the tabs, such as the report's download. */
  tabActions?: ReactNode
  /** The open tab's content. */
  children: ReactNode
}

/**
 * The frame of a campaign's pages, for its testers and reviewers: its name, status and creation
 * date, the agent it reviews, then its
 * tabs. A reviewer reads the overview and the report, a tester the overview and the final survey.
 */
export function ParticipantCampaignFrame({
  campaign,
  campaignRole,
  currentTab,
  canOpenSurvey = true,
  tabActions,
  children,
}: ParticipantCampaignFrameProps) {
  const navigate = useNavigate()
  const context = useCampaignContext(campaign)
  // The person's campaigns carry the date, which the campaign's context does not.
  const createdAt = useEvaluationWorkspace().myCampaigns.find(
    (candidate) => candidate.id === campaign.reviewCampaignId,
  )?.createdAt
  const handleTabChange = (value: unknown) => {
    if (campaignRole === "reviewer") {
      if (value === "overview") {
        void navigate({
          to: "/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review",
          params: campaign,
        })
      } else if (value === "report") {
        void navigate({
          to: "/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review/report",
          params: campaign,
        })
      }
    } else if (value === "overview") {
      void navigate({
        to: "/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test",
        params: campaign,
      })
    } else if (value === "survey") {
      void navigate({
        to: "/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test/survey",
        params: campaign,
      })
    }
  }
  return (
    <PageContainer>
      <PageHeader
        title={context.name}
        badge={<CampaignStatusBadge status={context.status} />}
        description={
          <CampaignDescription description={context.description} createdAt={createdAt} />
        }
      />
      <CampaignAgentCard agent={context.agent} />
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="overview">
              <Trans comment="The tab with a campaign's sessions, its first page for its participants">
                Sessions
              </Trans>
            </TabsTrigger>
            {campaignRole === "reviewer" ? (
              <TabsTrigger value="report">
                <Trans comment="The tab with the full report of a campaign">Report</Trans>
              </TabsTrigger>
            ) : (
              <TabsTrigger value="survey" disabled={!canOpenSurvey}>
                <Trans>Final survey</Trans>
              </TabsTrigger>
            )}
          </TabsList>
          {tabActions ? <div className="flex items-center gap-2">{tabActions}</div> : null}
        </div>
      </Tabs>
      {children}
    </PageContainer>
  )
}
