import { extractPromptVariables } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import { type PromptVariableField, PromptVariablesEditor } from "./PromptVariablesEditor"

/**
 * Collects the values for the {{variables}} the playground's settings revision declares,
 * before a session is created. Fields start blank: a blank falls back to the revision's
 * default, and a variable with neither a value nor a default keeps the chat from starting,
 * since the API would refuse the session.
 */
export function PromptVariablesSessionDialog({
  open,
  onOpenChange,
  agentSettings,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Settings of the revision the playground runs; `null` while the history is loading. */
  agentSettings: AgentSettings | null
  /** Called with the non-blank values only, once the dialog is dismissed by the confirm button. */
  onConfirm: (variables: Record<string, string>) => void
}) {
  const { t } = useTranslation()
  // Every chat starts from scratch: the operator fills in only what they want to test.
  const [values, setValues] = useState<Record<string, string>>({})
  useEffect(() => {
    if (open) setValues({})
  }, [open])

  const fields = useMemo<PromptVariableField[]>(() => {
    if (!agentSettings) return []
    const defaults = agentSettings.variables ?? {}
    return extractPromptVariables(agentSettings.instructions).map((name) => ({
      name,
      value: values[name] ?? "",
      defaultValue: defaults[name] ?? null,
    }))
  }, [agentSettings, values])

  const hasMissingRequired = fields.some(
    (field) => field.value.trim().length === 0 && (field.defaultValue ?? "").trim().length === 0,
  )

  const handleConfirm = () => {
    const variables: Record<string, string> = {}
    for (const field of fields) {
      const value = field.value.trim()
      if (value.length > 0) variables[field.name] = value
    }
    onConfirm(variables)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("promptVariables:title")}</DialogTitle>
          <DialogDescription>{t("promptVariables:dialog.description")}</DialogDescription>
        </DialogHeader>
        <PromptVariablesEditor fields={fields} onChange={setValues} requireValues />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("actions:cancel")}
          </Button>
          <Button disabled={hasMissingRequired} onClick={handleConfirm}>
            {t("promptVariables:dialog.start")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
