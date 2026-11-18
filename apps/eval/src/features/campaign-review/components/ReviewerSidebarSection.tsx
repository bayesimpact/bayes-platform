import type {
  ReviewCampaignParamsDto,
  ReviewerSessionListItemOutputDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { BarChart3Icon, LayoutListIcon } from "lucide-react"
import type { ReactNode } from "react"
import { SidebarSection } from "@/components/shared/SidebarSection"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { fullDateTimeOf } from "@/lib/format-time"
import { shortIdOf } from "@/lib/short-id"
import { reviewerSessionsQueryOptions } from "../api/queries"
import { splitReviewerSessions } from "../reviewer-sessions"

export type ReviewerSidebarSectionProps = {
  campaign: ReviewCampaignParamsDto
}

/**
 * A campaign in the sidebar, for one of its reviewers: its pages, then the sessions still to
 * review and the ones they reviewed.
 */
export function ReviewerSidebarSection({ campaign }: ReviewerSidebarSectionProps) {
  return (
    <>
      <div className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <Link
                  to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review"
                  params={campaign}
                  activeOptions={{ exact: true }}
                  activeProps={{ "data-active": true }}
                />
              }
            >
              <LayoutListIcon aria-hidden />
              <span>
                <Trans comment="The sidebar's link to the first page of a campaign">Overview</Trans>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <Link
                  to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review/report"
                  params={campaign}
                  activeProps={{ "data-active": true }}
                />
              }
            >
              <BarChart3Icon aria-hidden />
              <span>
                <Trans>Report</Trans>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
      <SidebarSection resetKey={campaign.reviewCampaignId}>
        <SessionLinks campaign={campaign} />
      </SidebarSection>
    </>
  )
}

function SessionLinks({ campaign }: ReviewerSidebarSectionProps) {
  const { data: sessions } = useSuspenseQuery(reviewerSessionsQueryOptions(campaign))
  const { toReview, reviewed } = splitReviewerSessions(sessions)
  if (toReview.length === 0 && reviewed.length === 0) {
    return (
      <p className="px-4 py-2 text-sm text-muted-foreground">
        <Trans>The sessions to review show here.</Trans>
      </p>
    )
  }
  return (
    <>
      <SessionGroup
        label={<Trans comment="The sessions a reviewer did not review yet">To review</Trans>}
        campaign={campaign}
        sessions={toReview}
      />
      <SessionGroup
        label={<Trans comment="The sessions a reviewer gave their review of">Reviewed</Trans>}
        campaign={campaign}
        sessions={reviewed}
      />
    </>
  )
}

type SessionGroupProps = {
  label: ReactNode
  campaign: ReviewCampaignParamsDto
  sessions: ReviewerSessionListItemOutputDto[]
}

function SessionGroup({ label, campaign, sessions }: SessionGroupProps) {
  const { i18n } = useLingui()
  if (sessions.length === 0) return null
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {sessions.map((session) => (
            <SidebarMenuItem key={session.sessionId}>
              <SidebarMenuButton
                render={
                  <Link
                    to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review/sessions/$sessionId"
                    params={{ ...campaign, sessionId: session.sessionId }}
                    activeProps={{ "data-active": true }}
                  />
                }
              >
                <span className="font-mono text-xs">{shortIdOf(session.sessionId)}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">
                  {fullDateTimeOf(session.startedAt, i18n.locale)}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
