import { SidebarMenuSubButton, SidebarMenuSubItem } from "@caseai-connect/app-ui/components/sidebar"
import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { ListIcon, PlusIcon } from "lucide-react"
import type { ReactNode } from "react"
import { SidebarSection } from "./SidebarSection"

export type DatasetsSidebarEntriesProps = {
  agentParams: AgentParamsDto
  /** Whether the person creates datasets: the menu then leads to a new one. */
  canCreate: boolean
  /** The links to the datasets, which load on their own: `DatasetSidebarLinks`. */
  children: ReactNode
}

/**
 * The entries of the sidebar's Evaluations menu, for an agent of any type: the table of its
 * project's datasets, the way to a new one, then each dataset.
 */
export function DatasetsSidebarEntries({
  agentParams,
  canCreate,
  children,
}: DatasetsSidebarEntriesProps) {
  const { t } = useLingui()
  return (
    <>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          render={
            <Link
              to="/o/$organizationId/p/$projectId/a/$agentId/evaluations"
              params={agentParams}
              activeOptions={{ exact: true }}
              activeProps={{ "data-active": true }}
              // The Campaigns menu has a List all too: this one says what it lists.
              aria-label={t`List all datasets`}
            />
          }
        >
          <ListIcon aria-hidden />
          <span>
            <Trans comment="The sidebar's link to the table of all the datasets of an agent's project">
              List all
            </Trans>
          </span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
      {canCreate ? (
        <SidebarMenuSubItem>
          <SidebarMenuSubButton
            render={
              <Link
                to="/o/$organizationId/p/$projectId/a/$agentId/evaluations"
                params={agentParams}
                search={{ create: true }}
                activeOptions={{ exact: true }}
                activeProps={{ "data-active": true }}
              />
            }
          >
            <PlusIcon aria-hidden />
            <span>
              <Trans>New dataset</Trans>
            </span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ) : null}
      <SidebarSection resetKey={agentParams.agentId}>{children}</SidebarSection>
    </>
  )
}
