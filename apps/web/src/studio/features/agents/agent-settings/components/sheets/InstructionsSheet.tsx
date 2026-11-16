import { Button } from "@caseai-connect/ui/shad/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@caseai-connect/ui/shad/sheet"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { AgentEditorSaveStatus } from "../AgentEditorSaveStatus"
import type { TabSaveState } from "../agent-tab-autosave"

/**
 * Full-page sheet to write the agent's instructions with room. The field it holds belongs to
 * the General tab's form, so it saves by itself to the draft like the rest of that tab: the
 * sheet says so and shows the state of the save. Closing it needs no confirmation.
 */
export function InstructionsSheet({
  open,
  onClose,
  saveState,
  hasDraft,
  onRetrySave,
  children,
}: {
  open: boolean
  onClose: () => void
  saveState: TabSaveState
  hasDraft: boolean
  onRetrySave: () => void
  /** The instructions field. It takes the height of the sheet. */
  children: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-none">
        {/* Room on the right for the sheet's close cross. */}
        <SheetHeader className="flex-row flex-wrap items-center justify-between gap-4 border-b pr-14">
          <div className="flex flex-col gap-1.5">
            <SheetTitle>{t("agentSettings:props.instructions")}</SheetTitle>
            <SheetDescription>{t("agentSettings:autosave.hint")}</SheetDescription>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <AgentEditorSaveStatus
              state={saveState}
              hasDraft={hasDraft}
              onRetry={onRetrySave}
              hideHint
            />
            <Button type="button" variant="outline" onClick={onClose}>
              {t("actions:close")}
            </Button>
          </div>
        </SheetHeader>

        <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-2 p-6">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
