import { Button } from "@bayes-platform/ui/shad/button"
import { ZapIcon } from "lucide-react"
import { type FormEvent, type ReactNode, useRef, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { usePreventLeave } from "@/common/hooks/use-prevent-leave"

/**
 * A section of the agent editor for settings that are not part of the draft (orchestration,
 * embed). Their changes go live as soon as they are saved, so they do not save by themselves
 * like the other sections: the user confirms them with Save.
 *
 * The notice, Cancel and Save stay in view above the form while it scrolls, so a long form
 * never hides them. A save applies the settings at once, so it asks first, whether it comes
 * from a Save button or from Enter in a field. Cancel puts the form back as it was saved. The
 * editor asks before it leaves the section with unsaved changes.
 */
export function LiveSettingsSection({
  formId,
  isDirty,
  isSubmitting = false,
  onReset,
  children,
}: {
  /** The `id` of the `<form>` rendered in `children`. */
  formId: string
  isDirty: boolean
  isSubmitting?: boolean
  /** Drops the unsaved changes. */
  onReset: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const [isConfirmingSave, setIsConfirmingSave] = useState(false)
  // Set once the user confirmed a save, so the submit that follows goes through.
  const isSaveConfirmed = useRef(false)
  // Browser-level leave (refresh / close tab).
  usePreventLeave(isDirty)

  // Every submit of the form passes here first, before the form's own handler: the buttons
  // above, and Enter in a field.
  const interceptSubmit = (event: FormEvent) => {
    if (isSaveConfirmed.current) {
      isSaveConfirmed.current = false
      return
    }
    event.preventDefault()
    event.stopPropagation()
    setIsConfirmingSave(true)
  }

  const confirmSave = () => {
    setIsConfirmingSave(false)
    const form = document.getElementById(formId)
    if (!(form instanceof HTMLFormElement)) return
    isSaveConfirmed.current = true
    form.requestSubmit()
    // The browser sends no submit when its own validation refuses the form (a malformed URL):
    // the confirmation must not stay valid for the next submit.
    isSaveConfirmed.current = false
  }

  return (
    <div className="flex flex-col gap-4" onSubmitCapture={interceptSubmit}>
      {/* Stays in view under the page header (53px high) while the form scrolls. The negative
          margins let its background cover the page's side padding, and the form fades out under
          it. */}
      <div className="sticky top-[53px] z-10 -mx-6 -mt-3 flex flex-wrap items-center justify-between gap-4 bg-background px-6 py-3 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-4 after:bg-linear-to-b after:from-background after:to-transparent">
        <p className="flex items-center gap-1.5 text-amber-700 text-sm dark:text-amber-400">
          <ZapIcon className="size-3.5 shrink-0" />
          <span>{t("agentSettings:liveSettings.notice")}</span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting || !isDirty}
            onClick={onReset}
          >
            {t("actions:cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting || !isDirty}>
            {t("actions:save")}
          </Button>
        </div>
      </div>

      {children}

      <ConfirmDialog
        open={isConfirmingSave}
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
        onCancel={() => setIsConfirmingSave(false)}
      />
    </div>
  )
}
