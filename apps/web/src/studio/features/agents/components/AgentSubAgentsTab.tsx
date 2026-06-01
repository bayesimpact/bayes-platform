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
import { BotIcon, PlusIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Agent } from "@/common/features/agents/agents.models"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { AgentSubAgentItem } from "./AgentSubAgentItem"

export type AgentSubAgentFormValue = {
  id: string
  agentId: string
  toolName: string
  description: string
  enabled: boolean
}

export function AgentSubAgentsTab({
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
        (agent.type === "conversation" || agent.type === "form") &&
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
        description: t("agent:orchestration.defaultDescription", { name: agent.name }),
        enabled: true,
      },
    ])
  }

  const removeSubAgent = (subAgentId: string) => {
    onChange(value.filter((subAgent) => subAgent.id !== subAgentId))
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>{t("agent:orchestration.selectedTitle")}</FieldLabel>
        {value.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BotIcon />
              </EmptyMedia>
              <EmptyTitle>{t("agent:orchestration.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("agent:orchestration.emptyDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup className="gap-3">
            {value.map((subAgent) => (
              <AgentSubAgentItem
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
        <FieldLabel>{t("agent:orchestration.availableTitle")}</FieldLabel>
        {availableAgents.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
            {t("agent:orchestration.noAvailableAgents")}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {availableAgents.map((agent) => {
              const Icon = getAgentIcon(agent.type)
              return (
                <Item key={agent.id} variant="outline">
                  <ItemMedia variant="icon">
                    <Icon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{agent.name}</ItemTitle>
                    <ItemDescription>{agent.instructions}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addSubAgent(agent)}
                    >
                      <PlusIcon />
                      {t("agent:orchestration.add")}
                    </Button>
                  </ItemActions>
                </Item>
              )
            })}
          </div>
        )}
      </Field>
    </FieldGroup>
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
