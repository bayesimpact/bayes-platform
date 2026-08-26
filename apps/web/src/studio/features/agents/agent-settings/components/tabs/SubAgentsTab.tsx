import { Button } from "@caseai-connect/ui/shad/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@caseai-connect/ui/shad/empty"
import { Field, FieldGroup, FieldLabel } from "@caseai-connect/ui/shad/field"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@caseai-connect/ui/shad/item"
import type { AgentSubAgentMode } from "@caseai-connect/api-contracts"
import { BotIcon, PlusIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { selectAgentSettingsDataByAgentId } from "@/common/features/agents/agent-settings/agent-settings.selectors"
import type { Agent } from "@/common/features/agents/agents.models"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { useValue } from "@/common/hooks/use-value"
import { SubAgentItem } from "../SubAgentItem"

export type AgentSubAgentFormValue = {
  id: string
  agentId: string
  toolName: string
  description: string
  enabled: boolean
  mode: AgentSubAgentMode
}

export function SubAgentsTab({
  parentAgentId,
  agents,
  value,
  onChange,
}: {
  parentAgentId: string
  agents: Agent[]
  value: AgentSubAgentFormValue[]
  onChange: (value: AgentSubAgentFormValue[]) => void
}) {
  const { t } = useTranslation()
  const selectedAgentIds = new Set(value.map((subAgent) => subAgent.agentId))
  const availableAgents = agents
    .filter(
      (agent) =>
        agent.type === "conversation" &&
        agent.id !== parentAgentId &&
        !selectedAgentIds.has(agent.id),
    )
    .sort((leftAgent, rightAgent) => leftAgent.name.localeCompare(rightAgent.name))

  const updateSubAgent = (
    subAgentId: string,
    fields: Partial<Omit<AgentSubAgentFormValue, "id" | "agentId">>,
  ) => {
    onChange(
      value.map((subAgent) => (subAgent.id === subAgentId ? { ...subAgent, ...fields } : subAgent)),
    )
  }

  const addSubAgent = (agent: Agent) => {
    onChange([
      ...value,
      {
        id: `sub-agent-${agent.id}`,
        agentId: agent.id,
        toolName: buildDefaultToolName(agent.name),
        description: t("agentSettings:orchestration.defaultDescription", { name: agent.name }),
        enabled: true,
        mode: "relay",
      },
    ])
  }

  const removeSubAgent = (subAgentId: string) => {
    onChange(value.filter((subAgent) => subAgent.id !== subAgentId))
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>{t("agentSettings:orchestration.selectedTitle")}</FieldLabel>
        {value.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BotIcon />
              </EmptyMedia>
              <EmptyTitle>{t("agentSettings:orchestration.emptyTitle")}</EmptyTitle>
              <EmptyDescription>
                {t("agentSettings:orchestration.emptyDescription")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup className="gap-3">
            {value.map((subAgent) => (
              <SubAgentItem
                key={subAgent.id}
                subAgent={subAgent}
                agent={agents.find((candidate) => candidate.id === subAgent.agentId)}
                onUpdate={(fields) => updateSubAgent(subAgent.id, fields)}
                onRemove={() => removeSubAgent(subAgent.id)}
              />
            ))}
          </ItemGroup>
        )}
      </Field>

      <Field>
        <FieldLabel>{t("agentSettings:orchestration.availableTitle")}</FieldLabel>
        {availableAgents.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
            {t("agentSettings:orchestration.noAvailableAgents")}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {availableAgents.map((agent) => (
              <AgentItem key={agent.id} agent={agent} addSubAgent={addSubAgent} />
            ))}
          </div>
        )}
      </Field>
    </FieldGroup>
  )
}

function AgentItem({ agent, addSubAgent }: { agent: Agent; addSubAgent: (agent: Agent) => void }) {
  const { t } = useTranslation()
  const agentSettings = useValue(selectAgentSettingsDataByAgentId({ agentId: agent.id }))
  const Icon = getAgentIcon(agent.type)
  return (
    <Item key={agent.id} variant="outline">
      <ItemMedia variant="icon">
        <Icon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{agent.name}</ItemTitle>
        <ItemDescription>{agentSettings.instructions}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button type="button" variant="outline" size="sm" onClick={() => addSubAgent(agent)}>
          <PlusIcon />
          {t("agentSettings:orchestration.add")}
        </Button>
      </ItemActions>
    </Item>
  )
}

function buildDefaultToolName(agentName: string): string {
  const slug = agentName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return `ask_${slug || "sub_agent"}`
}
