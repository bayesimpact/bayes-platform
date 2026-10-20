import { Item, ItemContent } from "@caseai-connect/ui/shad/item"
import { ScrollArea } from "@caseai-connect/ui/shad/scroll-area"
import { MarkdownWrapper } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/MarkdownWrapper"

/** The answer being saved, scrollable so a long one does not push the form out of view. */
export function TestCaseAnswerPreview({ answer }: { answer: string }) {
  return (
    // The viewport is what scrolls: a max height on the root alone lets a long answer spill
    // over the fields below it.
    <ScrollArea className="rounded-md [&>[data-slot=scroll-area-viewport]]:max-h-40">
      <Item variant="muted">
        <ItemContent className="text-sm">
          <MarkdownWrapper content={answer} />
        </ItemContent>
      </Item>
    </ScrollArea>
  )
}
