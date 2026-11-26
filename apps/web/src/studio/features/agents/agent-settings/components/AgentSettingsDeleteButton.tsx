import { Button } from "@bayes-platform/ui/shad/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@bayes-platform/ui/shad/tooltip"
import { Trash2Icon, Undo2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { deleteAgentSettings } from "@/common/features/agents/agent-settings/agent-settings.thunks"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"

/**
 * Why a revision cannot be deleted: the version in production is the one the agent runs with, the
 * newest revision is what the next draft starts from, and the draft of an agent that never saved
 * a version is its only settings. The API refuses all three.
 */
export type AgentSettingsDeleteBlocker = "production" | "latest" | "neverSaved"

/**
 * Removes the selected revision from the history, after a confirmation. On the draft, it reads
 * "Discard draft": the draft is saved on every change, so this is how its changes are undone.
 */
export function AgentSettingsDeleteButton({
  revision,
  isDraft,
  blocker,
}: {
  revision: number
  isDraft: boolean
  blocker?: AgentSettingsDeleteBlocker
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const agent = useValue(selectCurrentAgentData)
  const { abilities } = useAbility()
  const canManageAgent = abilities.canManageAgent({ agentId: agent.id })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const closeDialog = () => {
    setConfirmOpen(false)
    setError(null)
  }

  const handleConfirm = async () => {
    setIsDeleting(true)
    try {
      await dispatch(deleteAgentSettings({ revision, isDraft })).unwrap()
      closeDialog()
    } catch {
      setError(
        t(
          isDraft
            ? "agentSettings:notifications.draftDiscardError"
            : "agentSettings:notifications.versionDeleteError",
        ),
      )
    } finally {
      setIsDeleting(false)
    }
  }

  if (!canManageAgent) return null

  const Icon = isDraft ? Undo2Icon : Trash2Icon
  const label = isDraft ? t("agentSettings:history.discardDraft") : t("actions:delete")
  const dialogKey = isDraft ? "discardDraftDialog" : "deleteDialog"

  const button = (
    <Button
      size="sm"
      variant="outline"
      className="text-destructive hover:text-destructive"
      disabled={blocker !== undefined}
      onClick={() => setConfirmOpen(true)}
    >
      <Icon className="size-4" />
      {label}
    </Button>
  )

  return (
    <>
      {blocker ? (
        // A disabled button fires no pointer events, so the span carries the tooltip.
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{button}</span>
          </TooltipTrigger>
          <TooltipContent>{t(`agentSettings:history.deleteBlocked.${blocker}`)}</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
      <ConfirmDialog
        open={confirmOpen}
        title={t(`agentSettings:history.${dialogKey}.title`, { revision })}
        description={t(`agentSettings:history.${dialogKey}.description`, { revision })}
        confirmLabel={label}
        confirmIcon={<Icon className="size-5" />}
        onConfirm={handleConfirm}
        onCancel={closeDialog}
        error={error}
        isConfirming={isDeleting}
      />
    </>
  )
}
