import type { ReviewCampaignParamsDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  ClipboardListIcon,
  LayoutListIcon,
  SquarePenIcon,
} from "lucide-react"
import { SidebarSection } from "@/components/shared/SidebarSection"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useCampaignContext } from "@/features/campaign-context"
import { fullDateTimeOf } from "@/lib/format-time"
import { testerSessionsQueryOptions } from "../api/queries"
import { useOpenNewSession } from "../hooks/use-open-new-session"

export type TesterSidebarSectionProps = {
  campaign: ReviewCampaignParamsDto
}

/**
 * A campaign in the sidebar, for one of its testers: the way to a new conversation while the
 * campaign is active, its pages, then the sessions they started.
 */
export function TesterSidebarSection({ campaign }: TesterSidebarSectionProps) {
  const context = useCampaignContext(campaign)
  const newSession = useOpenNewSession(campaign)
  return (
    <>
      <div className="p-2">
        <SidebarMenu>
          {context.status === "active" ? (
            <SidebarMenuItem>
              <SidebarMenuButton onClick={newSession.open} disabled={newSession.isPending}>
                <SquarePenIcon aria-hidden />
                <span>
                  <Trans>New conversation</Trans>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <Link
                  to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test"
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
                  to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test/survey"
                  params={campaign}
                  activeProps={{ "data-active": true }}
                />
              }
            >
              <ClipboardListIcon aria-hidden />
              <span>
                <Trans>Final survey</Trans>
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

function SessionLinks({ campaign }: TesterSidebarSectionProps) {
  const { t, i18n } = useLingui()
  const { data: sessions } = useSuspenseQuery(testerSessionsQueryOptions(campaign))
  if (sessions.length === 0) {
    return (
      <p className="px-4 py-2 text-sm text-muted-foreground">
        <Trans>Your sessions show here.</Trans>
      </p>
    )
  }
  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        <Trans>Your sessions</Trans>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {sessions.map((session) => (
            <SidebarMenuItem key={session.id}>
              <SidebarMenuButton
                render={
                  <Link
                    to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test/sessions/$sessionId"
                    params={{ ...campaign, sessionId: session.id }}
                    activeProps={{ "data-active": true }}
                  />
                }
              >
                <span className="truncate">{fullDateTimeOf(session.createdAt, i18n.locale)}</span>
                {session.feedbackStatus === "pending" ? (
                  <span role="img" aria-label={t`Feedback to give`} className="ml-auto flex">
                    <CircleDashedIcon aria-hidden className="text-muted-foreground" />
                  </span>
                ) : (
                  <span role="img" aria-label={t`Feedback given`} className="ml-auto flex">
                    <CheckCircle2Icon aria-hidden className="text-primary" />
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
