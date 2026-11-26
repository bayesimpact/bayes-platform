import { SidebarMenuSub } from "@caseai-connect/app-ui/components/sidebar"
import type { ReviewCampaignParamsDto } from "@caseai-connect/eval-contracts"
import { shortDateTimeOf } from "@caseai-connect/frontend-lib"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { SidebarSessionItem } from "@/components/shared/SidebarSessionItem"
import { testerSessionsQueryOptions } from "../api/queries"

export type TesterSessionLinksProps = {
  campaign: ReviewCampaignParamsDto
}

/** The sessions of the open campaign, under it in the sidebar, for one of its testers. */
export function TesterSessionLinks({ campaign }: TesterSessionLinksProps) {
  const { t, i18n } = useLingui()
  const { data: sessions } = useSuspenseQuery(testerSessionsQueryOptions(campaign))
  if (sessions.length === 0) {
    return (
      <p className="px-4 py-1 text-xs text-muted-foreground">
        <Trans>No session yet.</Trans>
      </p>
    )
  }
  return (
    <SidebarMenuSub className="mr-0 pr-0">
      {sessions.map((session) => {
        const isDone = session.feedbackStatus !== "pending"
        return (
          <SidebarSessionItem
            key={session.id}
            link={
              <Link
                to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test/sessions/$sessionId"
                params={{ ...campaign, sessionId: session.id }}
                activeProps={{ "data-active": true }}
              />
            }
            label={shortDateTimeOf(session.createdAt, i18n.locale)}
            isDone={isDone}
            stateLabel={isDone ? t`Feedback given` : t`Feedback to give`}
          />
        )
      })}
    </SidebarMenuSub>
  )
}
