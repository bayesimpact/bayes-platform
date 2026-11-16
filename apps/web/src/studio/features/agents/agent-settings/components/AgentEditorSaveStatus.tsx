import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { AlertTriangleIcon, CheckIcon, Loader2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { TabSaveState } from "./agent-tab-autosave"

/**
 * Where the active tab stands with its automatic save. It stands in for the Save button the
 * tabs used to have: the user reads here that a change reached the draft, or that it did not.
 */
export function AgentEditorSaveStatus({
  state,
  hasDraft,
  onRetry,
  hideHint = false,
}: {
  state: TabSaveState
  /** The agent has a draft: without one, there is nothing saved to report yet. */
  hasDraft: boolean
  onRetry: () => void
  /** For a place that already says that changes save by themselves. */
  hideHint?: boolean
}) {
  const { t } = useTranslation()
  if (hideHint && state === "saved" && !hasDraft) return null

  if (state === "unsaved") {
    return (
      <output className="flex items-center gap-1 text-sm text-destructive">
        <AlertTriangleIcon className="size-4" />
        {t("agentSettings:autosave.unsaved")}
        <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
          {t("actions:retry")}
        </Button>
      </output>
    )
  }

  // A saved draft wears the colours of the Draft label, so it reads as the draft's state.
  if (state === "saved" && hasDraft) {
    return (
      <Badge asChild variant="warning">
        <output>
          <CheckIcon />
          {t("agentSettings:autosave.saved")}
        </output>
      </Badge>
    )
  }

  return (
    <output className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {state === "saving" ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          {t("agentSettings:autosave.saving")}
        </>
      ) : (
        t("agentSettings:autosave.hint")
      )}
    </output>
  )
}
