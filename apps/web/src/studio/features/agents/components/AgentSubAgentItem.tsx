import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { Field, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@caseai-connect/ui/shad/item"
import { Switch } from "@caseai-connect/ui/shad/switch"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/ui/shad/tooltip"
import { Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Agent } from "@/common/features/agents/agents.models"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import type { AgentSubAgentFormValue } from "./AgentSubAgentsTab"

export function AgentSubAgentItem({
  subAgent,
  agent,
  onUpdate,
  onRemove,
}: {
  subAgent: AgentSubAgentFormValue
  agent: Agent | undefined
  onUpdate: (fields: Partial<Omit<AgentSubAgentFormValue, "id" | "agentId">>) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()

  if (!agent) return null

  const title = agent.name
  const Icon = getAgentIcon(agent.type)

  return (
    <div className="rounded-md border">
      <Item>
        <ItemMedia variant="icon">
          <Icon />
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
            onCheckedChange={(enabled) => onUpdate({ enabled })}
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
                onClick={onRemove}
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
            onChange={(event) => onUpdate({ toolName: event.target.value })}
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
            onChange={(event) => onUpdate({ description: event.target.value })}
          />
        </Field>
      </div>
    </div>
  )
}
