import { SidebarMenuSubButton, SidebarMenuSubItem } from "@caseai-connect/app-ui/components/sidebar"
import type { ReviewCampaignStatusDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { Link, useParams } from "@tanstack/react-router"
import { ClipboardCheckIcon, MessagesSquareIcon } from "lucide-react"
import { SidebarCollapsibleSubMenu } from "@/components/shared/SidebarCollapsibleSubMenu"
import { SidebarSection } from "@/components/shared/SidebarSection"
import { SidebarSubGroupLabel } from "@/components/shared/SidebarSubGroupLabel"
import { campaignPathParams } from "@/features/agents"
import { ReviewerSessionLinks } from "@/features/campaign-review"
import { TesterSessionLinks } from "@/features/campaign-test"
import { CAMPAIGN_STATUS_LABELS } from "@/lib/campaign-status"
import { isMenuOpenAtFirst, useOpenSidebarMenu } from "./use-open-sidebar-menu"
import { useParticipantCampaigns } from "./use-participant-campaigns"

export type ParticipantSidebarMenusProps = {
  /** The agent whose campaigns the menus list. */
  agentId: string
}

/**
 * The campaigns of an agent the person takes part in, in two sub-menus of the Campaigns menu:
 * Reviewer, those where they read the testers' sessions, and Tester, those where they try the
 * agent, each under Active, then Closed. A sub-menu with no campaign does not show. Only the sub-menu of the current page opens at
 * first.
 */
export function ParticipantSidebarMenus({ agentId }: ParticipantSidebarMenusProps) {
  const { tested, reviewed } = useParticipantCampaigns(agentId)
  const openMenu = useOpenSidebarMenu()
  return (
    <>
      {reviewed.length > 0 ? (
        <SidebarCollapsibleSubMenu
          // Another page's menu starts afresh: it opens or folds as that page asks.
          key={`reviewer-${openMenu}`}
          Icon={ClipboardCheckIcon}
          isOpenAtFirst={isMenuOpenAtFirst("reviewer", openMenu)}
          label={
            <Trans comment="The sidebar's menu of the campaigns where the person reviews an agent's sessions">
              Reviewer
            </Trans>
          }
        >
          <CampaignLinks campaigns={reviewed} side="review" />
        </SidebarCollapsibleSubMenu>
      ) : null}
      {tested.length > 0 ? (
        <SidebarCollapsibleSubMenu
          key={`tester-${openMenu}`}
          Icon={MessagesSquareIcon}
          isOpenAtFirst={isMenuOpenAtFirst("tester", openMenu)}
          label={
            <Trans comment="The sidebar's menu of the campaigns where the person tests an agent">
              Tester
            </Trans>
          }
        >
          <CampaignLinks campaigns={tested} side="test" />
        </SidebarCollapsibleSubMenu>
      ) : null}
    </>
  )
}

/** The order of the groups: what is under way, then what is over. A draft is not theirs yet. */
const STATUS_ORDER = ["active", "closed"] as const satisfies ReviewCampaignStatusDto[]

type CampaignLinksProps = {
  campaigns: ReturnType<typeof useParticipantCampaigns>["tested"]
  /** The side of the campaigns the links open: the tester's or the reviewer's. */
  side: "test" | "review"
}

/**
 * The links of a sub-menu's campaigns, grouped by where they stand. The campaign whose page shows
 * lists its sessions under it.
 */
function CampaignLinks({ campaigns, side }: CampaignLinksProps) {
  const { i18n } = useLingui()
  const openMenu = useOpenSidebarMenu()
  const { reviewCampaignId } = useParams({ strict: false })
  // The campaign whose page shows on this side: a reviewer's page lists no tester's sessions.
  const isThisSide = openMenu === (side === "test" ? "tester" : "reviewer")
  const openCampaignId = isThisSide ? reviewCampaignId : undefined
  return STATUS_ORDER.map((status) => {
    const group = campaigns.filter((campaign) => campaign.status === status)
    if (group.length === 0) return null
    return [
      <SidebarSubGroupLabel key={status}>
        {i18n._(CAMPAIGN_STATUS_LABELS[status])}
      </SidebarSubGroupLabel>,
      ...group.map((campaign) => (
        <SidebarMenuSubItem key={campaign.id}>
          <SidebarMenuSubButton
            render={
              side === "test" ? (
                <Link
                  to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test"
                  params={campaignPathParams(campaign)}
                  activeProps={{ "data-active": true }}
                />
              ) : (
                <Link
                  to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review"
                  params={campaignPathParams(campaign)}
                  activeProps={{ "data-active": true }}
                />
              )
            }
          >
            <span className="truncate">{campaign.name}</span>
          </SidebarMenuSubButton>
          {/* The open campaign lists its sessions under it, on the side its page shows. */}
          {campaign.id === openCampaignId ? (
            <SidebarSection resetKey={`${side}-${campaign.id}`}>
              {side === "test" ? (
                <TesterSessionLinks campaign={campaignPathParams(campaign)} />
              ) : (
                <ReviewerSessionLinks campaign={campaignPathParams(campaign)} />
              )}
            </SidebarSection>
          ) : null}
        </SidebarMenuSubItem>
      )),
    ]
  })
}
