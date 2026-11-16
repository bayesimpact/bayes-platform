import { Button } from "@caseai-connect/ui/shad/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@caseai-connect/ui/shad/sheet"
import { AlertTriangleIcon } from "lucide-react"
import { type FormEvent, type ReactNode, useRef, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { usePreventLeave } from "@/common/hooks/use-prevent-leave"

/**
 * Full-page sheet for the agent settings that are not part of the draft (orchestration, embed).
 * Their changes go live as soon as they are saved, so they do not save by themselves like the
 * editor's tabs: the user confirms them with Save.
 *
 * Cancel and Save show twice, in the header that stays in view and under the form, so a long
 * form never hides them. Both go through an explicit confirmation: a save applies the settings
 * at once, so it asks first, whether it comes from a Save button or from Enter in a field; and
 * closing the sheet with unsaved changes (button, cross, Escape, click outside) asks before it
 * drops them.
 */
export function AgentEditorSheet({
  title,
  formId,
  isDirty,
  isSubmitting = false,
  onClose,
  children,
}: {
  title: string
  /** The `id` of the `<form>` rendered in `children`. */
  formId: string
  isDirty: boolean
  isSubmitting?: boolean
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState<"save" | "close" | null>(null)
  // Set once the user confirmed a save, so the submit that follows goes through.
  const isSaveConfirmed = useRef(false)
  // Browser-level leave (refresh / close tab).
  usePreventLeave(isDirty)

  const requestClose = () => {
    if (isDirty) setConfirming("close")
    else onClose()
  }

  // Every submit of the form passes here first, before the form's own handler: the buttons
  // below, and Enter in a field.
  const interceptSubmit = (event: FormEvent) => {
    if (isSaveConfirmed.current) {
      isSaveConfirmed.current = false
      return
    }
    event.preventDefault()
    event.stopPropagation()
    setConfirming("save")
  }

  const confirmSave = () => {
    setConfirming(null)
    const form = document.getElementById(formId)
    if (!(form instanceof HTMLFormElement)) return
    isSaveConfirmed.current = true
    form.requestSubmit()
    // The browser sends no submit when its own validation refuses the form (a malformed URL):
    // the confirmation must not stay valid for the next submit.
    isSaveConfirmed.current = false
  }

  const actions = (
    <div className="flex shrink-0 items-center gap-2">
      <Button type="button" variant="outline" disabled={isSubmitting} onClick={requestClose}>
        {isDirty ? t("actions:cancel") : t("actions:close")}
      </Button>
      <Button type="submit" form={formId} disabled={isSubmitting || !isDirty}>
        {t("actions:save")}
      </Button>
    </div>
  )

  return (
    <Sheet open onOpenChange={(open) => !open && requestClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-none">
        {/* Room on the right for the sheet's close cross. */}
        <SheetHeader className="flex-row flex-wrap items-center justify-between gap-4 border-b pr-14">
          <div className="flex flex-col gap-1.5">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{t("agentSettings:liveSettings.notice")}</SheetDescription>
          </div>
          {actions}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto" onSubmitCapture={interceptSubmit}>
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6">
            {children}
            <div className="flex justify-end border-t pt-4">{actions}</div>
          </div>
        </div>
      </SheetContent>

      <ConfirmDialog
        open={confirming === "close"}
        title={t("agentSettings:unsavedChanges.title")}
        description={t("agentSettings:unsavedChanges.description")}
        confirmLabel={t("actions:discard")}
        confirmIcon={<AlertTriangleIcon className="size-5" />}
        onConfirm={onClose}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === "save"}
        title={t("agentSettings:liveSettings.confirmSave.title")}
        description={
          <Trans
            i18nKey="agentSettings:liveSettings.confirmSave.description"
            components={{ strong: <strong className="font-semibold text-foreground" /> }}
          />
        }
        confirmLabel={t("actions:save")}
        confirmVariant="default"
        onConfirm={confirmSave}
        onCancel={() => setConfirming(null)}
      />
    </Sheet>
  )
}
