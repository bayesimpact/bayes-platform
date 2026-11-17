import { SUB_AGENT_DESCRIPTION_MAX_LENGTH } from "@caseai-connect/api-contracts"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { Switch } from "@caseai-connect/ui/shad/switch"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/ui/shad/tooltip"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import type { Agent } from "@/common/features/agents/agents.models"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import type { AgentSubAgentFormValue } from "./tabs/SubAgentsTab"

export function SubAgentItem({
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
  const { t, i18n } = useTranslation()
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false)

  if (!agent) return null

  const title = agent.name
  const Icon = getAgentIcon(agent.type)
  const isUnpublished = !agent.currentRevision

  return (
    <div className="rounded-md border">
      <Item>
        <ItemMedia variant="icon">
          <Icon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            {title}
            {/* The orchestrator only gets a sub-agent that was published at least once. */}
            {isUnpublished ? (
              <Badge variant="warning">{t("status:draft")}</Badge>
            ) : (
              <Badge variant={subAgent.enabled ? "default" : "secondary"}>
                {subAgent.enabled
                  ? t("agentSettings:orchestration.enabled")
                  : t("agentSettings:orchestration.disabled")}
              </Badge>
            )}
          </ItemTitle>
          <ItemDescription>
            {subAgent.toolName}
            {subAgent.mode === "handoff" && (
              <>
                {" "}
                <Badge variant="outline">{t("agentSettings:orchestration.modeHandoff")}</Badge>
              </>
            )}
            {isUnpublished && (
              <span className="block">{t("agentSettings:orchestration.unpublishedHint")}</span>
            )}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Switch
            checked={subAgent.enabled}
            onCheckedChange={(enabled) => onUpdate({ enabled })}
            aria-label={t("agentSettings:orchestration.enabled")}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                aria-label={t("agentSettings:orchestration.remove")}
                onClick={() => setIsConfirmingRemove(true)}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("agentSettings:orchestration.remove")}</TooltipContent>
          </Tooltip>
        </ItemActions>
      </Item>
      <div className="grid gap-4 border-t p-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`sub-agent-tool-name-${subAgent.id}`}>
            {t("agentSettings:orchestration.toolName")}
          </FieldLabel>
          <Input
            id={`sub-agent-tool-name-${subAgent.id}`}
            value={subAgent.toolName}
            placeholder={t("agentSettings:orchestration.toolNamePlaceholder")}
            onChange={(event) => onUpdate({ toolName: event.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`sub-agent-mode-${subAgent.id}`}>
            {t("agentSettings:orchestration.mode")}
          </FieldLabel>
          <Select
            value={subAgent.mode}
            onValueChange={(mode) => onUpdate({ mode: mode as AgentSubAgentFormValue["mode"] })}
          >
            <SelectTrigger id={`sub-agent-mode-${subAgent.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relay">{t("agentSettings:orchestration.modeRelay")}</SelectItem>
              <SelectItem value="handoff">
                {t("agentSettings:orchestration.modeHandoff")}
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-sm">
            {subAgent.mode === "handoff"
              ? t("agentSettings:orchestration.modeHandoffHint")
              : t("agentSettings:orchestration.modeRelayHint")}
          </p>
        </Field>
        <Field className="md:col-span-2">
          <FieldLabel htmlFor={`sub-agent-description-${subAgent.id}`}>
            {t("agentSettings:orchestration.description")}
            <span className="font-normal text-muted-foreground">
              {t("agentSettings:props.characterCountWithMax", {
                current: subAgent.description.length.toLocaleString(i18n.language),
                max: SUB_AGENT_DESCRIPTION_MAX_LENGTH.toLocaleString(i18n.language),
              })}
            </span>
          </FieldLabel>
          <Textarea
            id={`sub-agent-description-${subAgent.id}`}
            value={subAgent.description}
            maxLength={SUB_AGENT_DESCRIPTION_MAX_LENGTH}
            // Three lines tall by default, then as tall as its text.
            className="min-h-20 resize-none"
            onChange={(event) => onUpdate({ description: event.target.value })}
          />
        </Field>
      </div>

      {/* Removing drops the tool name and the description the user wrote: it asks first. */}
      <ConfirmDialog
        open={isConfirmingRemove}
        title={t("agentSettings:orchestration.removeConfirm.title", { name: agent.name })}
        description={t("agentSettings:orchestration.removeConfirm.description")}
        confirmLabel={t("agentSettings:orchestration.remove")}
        onConfirm={onRemove}
        onCancel={() => setIsConfirmingRemove(false)}
      />
    </div>
  )
}
