import { Badge } from "@bayes-platform/ui/shad/badge"
import { Button } from "@bayes-platform/ui/shad/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@bayes-platform/ui/shad/empty"
import { FieldGroup } from "@bayes-platform/ui/shad/field"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@bayes-platform/ui/shad/item"
import { Switch } from "@bayes-platform/ui/shad/switch"
import { ExternalLinkIcon, ServerIcon, WrenchIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { McpServerConnectionBadge } from "@/studio/features/mcp-servers/components/McpServerConnectionStatus"
import { McpServerToolsDialog } from "@/studio/features/mcp-servers/components/McpServerToolsDialog"
import type { McpServer } from "@/studio/features/mcp-servers/mcp-servers.models"
import {
  connectionOf,
  selectMcpServerConnections,
} from "@/studio/features/mcp-servers/mcp-servers.selectors"
import {
  disableMcpServerForAgent,
  enableMcpServerForAgent,
  inspectMcpServer,
} from "@/studio/features/mcp-servers/mcp-servers.thunks"
import { StudioRoutes } from "@/studio/routes/helpers"
import { LiveSettingNotice } from "../LiveSettingNotice"

export type AgentMcpServerDisplay = {
  id: string
  name: string
  enabled: boolean
}

export function McpServersTab({
  agentId,
  agentMcpServers,
  mcpServers,
}: {
  agentId: string
  agentMcpServers: AgentMcpServerDisplay[]
  /** The project's servers this agent may enable. */
  mcpServers: McpServer[]
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const managerPath = StudioRoutes.mcpServers.build({ organizationId, projectId })

  const connections = useAppSelector(selectMcpServerConnections)
  const [inspectedServerId, setInspectedServerId] = useState<string | null>(null)
  const inspectedServer = mcpServers.find((server) => server.id === inspectedServerId)

  // The tools are only asked for when someone wants to see them: opening an
  // agent must not connect to every server of the project.
  const handleViewTools = (mcpServerId: string) => {
    setInspectedServerId(mcpServerId)
    if (connectionOf(connections, mcpServerId).state === "unknown") {
      dispatch(inspectMcpServer({ mcpServerId }))
    }
  }

  const enabledServerIds = new Set(
    agentMcpServers.filter((server) => server.enabled).map((server) => server.id),
  )

  const handleToggle = (mcpServerId: string, enabled: boolean) => {
    if (enabled) {
      dispatch(enableMcpServerForAgent({ mcpServerId, agentId }))
    } else {
      dispatch(disableMcpServerForAgent({ mcpServerId, agentId }))
    }
  }

  if (mcpServers.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ServerIcon />
          </EmptyMedia>
          <EmptyTitle>{t("agentSettings:mcpServers.emptyTitle")}</EmptyTitle>
          <EmptyDescription>{t("agentSettings:mcpServers.emptyDescription")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <FieldGroup>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t("agentSettings:mcpServers.label")}</span>
        <Link
          to={managerPath}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          {t("agentSettings:mcpServers.manage")}
          <ExternalLinkIcon className="size-3.5" />
        </Link>
      </div>
      <LiveSettingNotice />
      <ItemGroup className="gap-3">
        {mcpServers.map((server) => (
          <Item key={server.id} variant="outline">
            <ItemMedia variant="icon">
              <ServerIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle className="gap-2">
                {server.name}
                {server.isBuiltIn && <Badge variant="secondary">{t("mcpServers:builtIn")}</Badge>}
                <McpServerConnectionBadge
                  connection={connectionOf(connections, server.id)}
                  authStatus={server.authStatus}
                />
              </ItemTitle>
              {server.isBuiltIn && (
                <ItemDescription>
                  {t("agentSettings:mcpServers.builtInDescription")}
                </ItemDescription>
              )}
            </ItemContent>
            <Button variant="ghost" size="sm" onClick={() => handleViewTools(server.id)}>
              <WrenchIcon className="size-3.5" /> {t("mcpServers:tools.view")}
            </Button>
            <Switch
              checked={enabledServerIds.has(server.id)}
              onCheckedChange={(checked) => handleToggle(server.id, checked)}
            />
          </Item>
        ))}
      </ItemGroup>
      {inspectedServer && (
        <McpServerToolsDialog
          serverName={inspectedServer.name}
          authStatus={inspectedServer.authStatus}
          connection={connectionOf(connections, inspectedServer.id)}
          open
          onOpenChange={(open) => {
            if (!open) setInspectedServerId(null)
          }}
          onRefresh={() => dispatch(inspectMcpServer({ mcpServerId: inspectedServer.id }))}
        />
      )}
    </FieldGroup>
  )
}
