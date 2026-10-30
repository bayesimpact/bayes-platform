import type { ConversationParamsDto } from "@caseai-connect/desk-contracts"
import { Plural } from "@lingui/react/macro"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import type { ChatSource } from "../chat-messages"
import { SourceItem } from "./SourceItem"

export type SourcesListProps = {
  conversation: ConversationParamsDto
  sources: ChatSource[]
}

/**
 * The documents a reply relied on, as the shadcn Sources pattern: one line that opens on the
 * documents and the passages cited.
 */
export function SourcesList({ conversation, sources }: SourcesListProps) {
  const count = sources.length
  return (
    <Trace>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceTitle>
              <Plural value={count} one="Used # source" other="Used # sources" />
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <ul className="flex flex-col gap-4">
            {sources.map((source) => (
              <SourceItem key={source.documentId} conversation={conversation} source={source} />
            ))}
          </ul>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}
