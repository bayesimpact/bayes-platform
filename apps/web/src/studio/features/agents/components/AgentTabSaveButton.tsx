import { Button } from "@caseai-connect/ui/shad/button"
import { Field } from "@caseai-connect/ui/shad/field"
import { useTranslation } from "react-i18next"

// Shared Save row for every agent editor tab. Disabled while submitting and when the tab has no
// unsaved changes (ADR 0012 §3.5: edit-only forms also disable on `!isDirty`).
export function AgentTabSaveButton({
  isSubmitting,
  isDirty,
}: {
  isSubmitting: boolean
  isDirty: boolean
}) {
  const { t } = useTranslation()
  return (
    <Field orientation="horizontal" className="justify-end">
      <Button type="submit" className="w-fit" disabled={isSubmitting || !isDirty}>
        {t("actions:save")}
      </Button>
    </Field>
  )
}
