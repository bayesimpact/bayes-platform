import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@caseai-connect/ui/shad/empty"
import { Field, FieldGroup, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@caseai-connect/ui/shad/item"
import { Switch } from "@caseai-connect/ui/shad/switch"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/ui/shad/tooltip"
import { BotIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Agent } from "@/common/features/agents/agents.models"

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
    .filter((agent) => agent.id !== parentAgentId && !selectedAgentIds.has(agent.id))
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
            {value.map((subAgent) => {
              const agent = agents.find((candidate) => candidate.id === subAgent.agentId)
              const title = agent?.name ?? t("agent:orchestration.missingAgent")
              return (
                <div key={subAgent.id} className="rounded-md border">
                  <Item>
                    <ItemMedia variant="icon">
                      <BotIcon />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>
                        {title}
                        <Badge variant={subAgent.enabled ? "default" : "secondary"}>
                          {subAgent.enabled
                            ? t("agent:orchestration.enabled")
                            : t("agent:orchestration.disabled")}
                        </Badge>
                      </ItemTitle>
                      <ItemDescription>{subAgent.toolName}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Switch
                        checked={subAgent.enabled}
                        onCheckedChange={(enabled) => updateSubAgent(subAgent.id, { enabled })}
                        aria-label={t("agent:orchestration.enabled")}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            aria-label={t("agent:orchestration.remove")}
                            onClick={() => removeSubAgent(subAgent.id)}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("agent:orchestration.remove")}</TooltipContent>
                      </Tooltip>
                    </ItemActions>
                  </Item>
                  <div className="grid gap-4 border-t p-4 md:grid-cols-[minmax(12rem,18rem)_1fr]">
                    <Field>
                      <FieldLabel htmlFor={`sub-agent-tool-name-${subAgent.id}`}>
                        {t("agent:orchestration.toolName")}
                      </FieldLabel>
                      <Input
                        id={`sub-agent-tool-name-${subAgent.id}`}
                        value={subAgent.toolName}
                        placeholder={t("agent:orchestration.toolNamePlaceholder")}
                        onChange={(event) =>
                          updateSubAgent(subAgent.id, { toolName: event.target.value })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`sub-agent-description-${subAgent.id}`}>
                        {t("agent:orchestration.description")}
                      </FieldLabel>
                      <Textarea
                        id={`sub-agent-description-${subAgent.id}`}
                        value={subAgent.description}
                        rows={2}
                        className="min-h-20"
                        onChange={(event) =>
                          updateSubAgent(subAgent.id, { description: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                </div>
              )
            })}
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
            {availableAgents.map((agent) => (
              <Item key={agent.id} variant="outline">
                <ItemMedia variant="icon">
                  <BotIcon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{agent.name}</ItemTitle>
                  <ItemDescription>{agent.defaultPrompt}</ItemDescription>
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
            ))}
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
