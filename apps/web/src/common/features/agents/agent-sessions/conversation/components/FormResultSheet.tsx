import { Button } from "@caseai-connect/ui/shad/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@caseai-connect/ui/shad/sheet"
import { ClipboardListIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { FormResultFields } from "@/common/features/agents/agent-sessions/conversation/components/FormResultFields"

/**
 * Opens the current form result of a fillForm-enabled session in a right-side
 * sheet. Triggered from the "Filling in the form…" step in the reasoning
 * timeline; reuses the shared FormResultFields renderer.
 */
export function FormResultSheet({
  outputJsonSchema,
  result,
}: {
  outputJsonSchema: Record<string, unknown>
  result?: Record<string, unknown>
}) {
  const { t } = useTranslation()

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground text-xs">
          <ClipboardListIcon className="size-3.5" />
          {t("conversationAgentSession:formState.show")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("conversationAgentSession:props.result")}</SheetTitle>
          <SheetDescription>{t("conversationAgentSession:formState.description")}</SheetDescription>
        </SheetHeader>
        {/* Fixed header above; only the fields scroll when the form is long. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <FormResultFields outputJsonSchema={outputJsonSchema} result={result} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
