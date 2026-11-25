import {
  type AgentParamsDto,
  EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION,
} from "@bayes-platform/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { FlaskConicalIcon, LayoutGridIcon } from "lucide-react"
import { SidebarCollapsibleMenu } from "@/components/shared/SidebarCollapsibleMenu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { ConversationDatasetsSidebarEntries } from "@/features/conversation-datasets"
import { ExtractionDatasetsSidebarEntries } from "@/features/extraction-datasets"
import type { AgentSection } from "./agent-sections"
import { CampaignsMenu } from "./CampaignsMenu"
import { isTopMenuOpenAtFirst, useOpenSidebarTopMenu } from "./use-open-sidebar-menu"

export type AgentSectionsNavProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  sections: AgentSection[]
}

/**
 * What an agent opens for the person, at the top of the sidebar: the way back to the agent's first
 * page when it holds several sections, its evaluations, a menu of its project's datasets,
 * the Campaigns menu: the review campaigns
 * for who manages them, and those the person reviews or tests.
 */
export function AgentSectionsNav({ agent, agentParams, sections }: AgentSectionsNavProps) {
  const { t } = useLingui()
  const agentName = agent.name
  const openTopMenu = useOpenSidebarTopMenu()
  return (
    <nav aria-label={t`Sections of ${agentName}`} className="p-2">
      <SidebarMenu>
        {sections.length > 1 ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <Link
                  to="/o/$organizationId/p/$projectId/a/$agentId"
                  params={agentParams}
                  activeOptions={{ exact: true }}
                  activeProps={{ "data-active": true }}
                />
              }
            >
              <LayoutGridIcon aria-hidden />
              <span>
                <Trans comment="The sidebar's link to the first page of an agent, which lists its sections">
                  Overview
                </Trans>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
        {sections.includes("evaluations") ? (
          <SidebarCollapsibleMenu
            // Another section's page starts the menu afresh: it opens or folds as that page asks.
            key={`evaluations-${openTopMenu}`}
            isOpenAtFirst={isTopMenuOpenAtFirst("evaluations", openTopMenu)}
            Icon={FlaskConicalIcon}
            label={<Trans>Evaluations</Trans>}
          >
            {agent.type === "conversation" ? (
              <ConversationDatasetsSidebarEntries
                agentParams={agentParams}
                canCreate={hasProjectPermission(
                  agent.project,
                  EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
                )}
              />
            ) : (
              <ExtractionDatasetsSidebarEntries
                agentParams={agentParams}
                canCreate={hasProjectPermission(
                  agent.project,
                  EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION,
                )}
              />
            )}
          </SidebarCollapsibleMenu>
        ) : null}
        <CampaignsMenu
          agentId={agent.id}
          managed={sections.includes("campaigns") ? { agent, agentParams } : null}
        />
      </SidebarMenu>
    </nav>
  )
}
