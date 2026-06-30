import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@caseai-connect/ui/shad/empty"
import { FieldGroup } from "@caseai-connect/ui/shad/field"
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@caseai-connect/ui/shad/item"
import { Switch } from "@caseai-connect/ui/shad/switch"
import { ExternalLinkIcon, ServerIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { selectMcpServersData } from "@/studio/features/mcp-servers/mcp-servers.selectors"
import {
  disableMcpServerForAgent,
  enableMcpServerForAgent,
} from "@/studio/features/mcp-servers/mcp-servers.thunks"
import { StudioRoutes } from "@/studio/routes/helpers"

export type AgentMcpServerDisplay = {
  id: string
  name: string
  enabled: boolean
}

export function AgentMcpServersTab({
  agentId,
  agentMcpServers,
}: {
  agentId: string
  agentMcpServers: AgentMcpServerDisplay[]
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const projectMcpServers = useValue(selectMcpServersData)
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const managerPath = StudioRoutes.mcpServers.build({ organizationId, projectId })

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

  if (projectMcpServers.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ServerIcon />
          </EmptyMedia>
          <EmptyTitle>{t("agent:mcpServers.emptyTitle")}</EmptyTitle>
          <EmptyDescription>{t("agent:mcpServers.emptyDescription")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <FieldGroup>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t("agent:mcpServers.label")}</span>
        <Link
          to={managerPath}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          {t("agent:mcpServers.manage")}
          <ExternalLinkIcon className="size-3.5" />
        </Link>
      </div>
      <ItemGroup className="gap-3">
        {projectMcpServers.map((server) => (
          <Item key={server.id} variant="outline">
            <ItemMedia variant="icon">
              <ServerIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{server.name}</ItemTitle>
            </ItemContent>
            <Switch
              checked={enabledServerIds.has(server.id)}
              onCheckedChange={(checked) => handleToggle(server.id, checked)}
            />
          </Item>
        ))}
      </ItemGroup>
    </FieldGroup>
  )
}
