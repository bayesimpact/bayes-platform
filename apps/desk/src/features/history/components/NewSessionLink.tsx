import { Trans } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { SquarePenIcon } from "lucide-react"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { agentParamsOf } from "@/lib/agent-params"
import type { HistoryAgent } from "../history-entries"

export type NewSessionLinkProps = {
  agent: HistoryAgent
}

/** Opens a new conversation, or a new extraction, with the current agent. */
export function NewSessionLink({ agent }: NewSessionLinkProps) {
  const params = agentParamsOf(agent)
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          render={
            agent.type === "conversation" ? (
              <Link
                to="/o/$organizationId/p/$projectId/a/$agentId"
                params={params}
                activeOptions={{ exact: true }}
              />
            ) : (
              <Link
                to="/o/$organizationId/p/$projectId/a/$agentId/extraction"
                params={params}
                activeOptions={{ exact: true }}
              />
            )
          }
        >
          <SquarePenIcon aria-hidden />
          {agent.type === "conversation" ? (
            <Trans>New conversation</Trans>
          ) : (
            <Trans>New extraction</Trans>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
