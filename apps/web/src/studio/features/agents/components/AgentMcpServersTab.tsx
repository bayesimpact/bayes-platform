import { Badge } from "@caseai-connect/ui/shad/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@caseai-connect/ui/shad/empty"
import { FieldGroup } from "@caseai-connect/ui/shad/field"
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@caseai-connect/ui/shad/item"
import { ServerIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

export type AgentMcpServerDisplay = {
  id: string
  name: string
  enabled: boolean
}

export function AgentMcpServersTab({ mcpServers }: { mcpServers: AgentMcpServerDisplay[] }) {
  const { t } = useTranslation()

  if (mcpServers.length === 0) {
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
      <ItemGroup className="gap-3">
        {mcpServers.map((server) => (
          <Item key={server.id} variant="outline">
            <ItemMedia variant="icon">
              <ServerIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{server.name}</ItemTitle>
            </ItemContent>
            <Badge variant={server.enabled ? "success" : "secondary"}>
              {server.enabled ? t("agent:mcpServers.enabled") : t("agent:mcpServers.disabled")}
            </Badge>
          </Item>
        ))}
      </ItemGroup>
    </FieldGroup>
  )
}
