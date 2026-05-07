import { Badge } from "@caseai-connect/ui/shad/badge"
import { Item, ItemHeader, ItemTitle } from "@caseai-connect/ui/shad/item"
import { Separator } from "@caseai-connect/ui/shad/separator"
import { useTranslation } from "react-i18next"
import type { FormAgentSession } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.models"
import { collectFormDisplayKeys } from "@/common/features/agents/agent-sessions/form/output-schema-keys.helpers"
import type { Agent } from "@/common/features/agents/agents.models"

export function FormResult({
  agent,
  agentSession,
}: {
  agent: Agent
  agentSession: FormAgentSession
}) {
  const { t } = useTranslation()
  const form = buildForm({ agent, agentSession })
  return (
    <Item className="absolute inset-0 flex-col items-stretch flex-nowrap gap-0 p-0">
      <ItemHeader className="basis-auto shrink-0 px-4 pt-4 pb-2">
        <ItemTitle className="text-lg">{t("formAgentSession:props.result")}</ItemTitle>
      </ItemHeader>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <div className="flex flex-col gap-1">
          {Object.entries(form).map(([key, value], index) => {
            const hasValue = value !== ""
            return (
              <div key={key}>
                {index > 0 && <Separator className="opacity-50" />}
                <div className="flex gap-2 py-4 items-center">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {key}
                  </span>
                  {hasValue ? (
                    <Badge variant="outline" className="w-fit text-muted-foreground font-mono">
                      {value}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="w-fit text-muted-foreground opacity-50 font-mono"
                    >
                      —
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Item>
  )
}

function buildForm({ agent, agentSession }: { agent: Agent; agentSession: FormAgentSession }) {
  const keys = collectFormDisplayKeys(agent.outputJsonSchema, agentSession.result)
  const form: Record<string, string> = {}
  for (const key of keys) {
    const value = agentSession.result?.[key]
    form[key] = value === undefined || value === null ? "" : formatValue(value)
  }
  return form
}

function formatValue(value: unknown): string {
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}
