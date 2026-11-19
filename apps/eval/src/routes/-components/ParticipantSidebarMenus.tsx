import type { ReviewCampaignStatusDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { ClipboardCheckIcon, MessagesSquareIcon } from "lucide-react"
import { SidebarCollapsibleSubMenu } from "@/components/shared/SidebarCollapsibleSubMenu"
import { SidebarSubGroupLabel } from "@/components/shared/SidebarSubGroupLabel"
import { SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar"
import { campaignPathParams } from "@/features/agents"
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

/** The links of a sub-menu's campaigns, grouped by where they stand. */
function CampaignLinks({ campaigns, side }: CampaignLinksProps) {
  const { i18n } = useLingui()
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
        </SidebarMenuSubItem>
      )),
    ]
  })
}
