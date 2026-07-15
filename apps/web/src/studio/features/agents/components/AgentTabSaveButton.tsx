import { Button } from "@caseai-connect/ui/shad/button"
import { Field } from "@caseai-connect/ui/shad/field"
import { useTranslation } from "react-i18next"

// Shared Save row for every agent editor tab. Disabled while submitting and when the tab has no
// unsaved changes (ADR 0012 §3.5: edit-only forms also disable on `!isDirty`).
// Pass `onCancel` to also render a "Cancel changes" button that discards unsaved edits.
export function AgentTabSaveButton({
  isSubmitting,
  isDirty,
  onCancel,
}: {
  isSubmitting: boolean
  isDirty: boolean
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  return (
    <Field orientation="horizontal" className="justify-end">
      {onCancel && (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          disabled={isSubmitting || !isDirty}
          onClick={onCancel}
        >
          {t("actions:cancel")}
        </Button>
      )}
      <Button type="submit" className="w-fit" disabled={isSubmitting || !isDirty}>
        {t("actions:save")}
      </Button>
    </Field>
  )
}
