import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { cn } from "@caseai-connect/ui/utils"
import { AlertTriangleIcon, CheckIcon, Loader2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { TabSaveState } from "./agent-tab-autosave"

/** Larger than a plain badge: this label is the only sign of the automatic save. */
const labelSize = "px-3 py-1 text-sm [&>svg]:size-3.5"

/**
 * Where the active tab stands with its automatic save. It stands in for the Save button the
 * tabs used to have: the user reads here that a change reached the draft, or that it did not.
 */
export function AgentEditorSaveStatus({
  state,
  hasDraft,
  onRetry,
  onOpenHistory,
}: {
  state: TabSaveState
  /** The agent has a draft: without one, there is nothing saved to report yet. */
  hasDraft: boolean
  onRetry: () => void
  /** Makes the saved draft a button that opens the version history, where the draft is saved as a version. */
  onOpenHistory?: () => void
}) {
  const { t } = useTranslation()

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
    if (onOpenHistory) {
      return (
        <Badge
          asChild
          variant="warning"
          className={cn(labelSize, "cursor-pointer hover:brightness-95")}
        >
          <button type="button" aria-haspopup="dialog" onClick={onOpenHistory}>
            <CheckIcon />
            {t("agentSettings:autosave.saved")}
          </button>
        </Badge>
      )
    }
    return (
      <Badge asChild variant="warning" className={labelSize}>
        <output>
          <CheckIcon />
          {t("agentSettings:autosave.saved")}
        </output>
      </Badge>
    )
  }

  // A save in progress wears the primary colour: it stands out from the saved draft's label
  // that takes its place a moment later.
  if (state === "saving") {
    return (
      <Badge asChild variant="default" className={labelSize}>
        <output>
          <Loader2Icon className="animate-spin" />
          {t("agentSettings:autosave.saving")}
        </output>
      </Badge>
    )
  }

  return (
    <output className="text-sm text-muted-foreground">{t("agentSettings:autosave.hint")}</output>
  )
}
