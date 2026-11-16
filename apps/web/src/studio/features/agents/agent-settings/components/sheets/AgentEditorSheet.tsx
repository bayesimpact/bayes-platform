import { Button } from "@caseai-connect/ui/shad/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@caseai-connect/ui/shad/sheet"
import { AlertTriangleIcon } from "lucide-react"
import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { usePreventLeave } from "@/common/hooks/use-prevent-leave"

/**
 * Full-page sheet for the agent settings that are not part of the draft (orchestration, embed).
 * Their changes go live as soon as they are saved, so they do not save by themselves like the
 * editor's tabs: the user confirms them with Save.
 *
 * Cancel and Save show twice, in the header that stays in view and under the form, so a long
 * form never hides them. The Save buttons submit the form that carries `formId`. Closing the
 * sheet with unsaved changes (button, cross, Escape, click outside) asks first.
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
  const [isConfirmingClose, setIsConfirmingClose] = useState(false)
  // Browser-level leave (refresh / close tab).
  usePreventLeave(isDirty)

  const requestClose = () => {
    if (isDirty) setIsConfirmingClose(true)
    else onClose()
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

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6">
            {children}
            <div className="flex justify-end border-t pt-4">{actions}</div>
          </div>
        </div>
      </SheetContent>

      <ConfirmDialog
        open={isConfirmingClose}
        title={t("agentSettings:unsavedChanges.title")}
        description={t("agentSettings:unsavedChanges.description")}
        confirmLabel={t("actions:discard")}
        confirmIcon={<AlertTriangleIcon className="size-5" />}
        onConfirm={onClose}
        onCancel={() => setIsConfirmingClose(false)}
      />
    </Sheet>
  )
}
