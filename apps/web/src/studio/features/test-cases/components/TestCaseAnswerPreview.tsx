import { Item, ItemContent } from "@caseai-connect/ui/shad/item"
import { ScrollArea } from "@caseai-connect/ui/shad/scroll-area"
import { MarkdownWrapper } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/MarkdownWrapper"

/** The answer being saved, scrollable so a long one does not push the form out of view. */
export function TestCaseAnswerPreview({ answer }: { answer: string }) {
  return (
    <ScrollArea className="max-h-40">
      <Item variant="muted">
        <ItemContent className="text-sm">
          <MarkdownWrapper content={answer} />
        </ItemContent>
      </Item>
    </ScrollArea>
  )
}
