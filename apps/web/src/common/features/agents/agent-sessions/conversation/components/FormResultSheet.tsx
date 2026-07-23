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
        <Button
          variant="ghost"
          size="sm"
          className="h-auto w-fit gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ClipboardListIcon className="size-3.5" />
          {t("conversationAgentSession:formState.show")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("conversationAgentSession:props.result")}</SheetTitle>
          <SheetDescription>{t("conversationAgentSession:formState.description")}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <FormResultFields outputJsonSchema={outputJsonSchema} result={result} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
