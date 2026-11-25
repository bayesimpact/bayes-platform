import type {
  ConversationMessageOutputDto,
  ConversationParamsDto,
} from "@bayes-platform/eval-contracts"
import { useState } from "react"
import { RELATIVE_TIME_INTERVAL_IN_MILLISECONDS, useNow } from "@/hooks/use-now"
import { toChatMessages } from "../chat-messages"
import { useCitedPassages } from "../hooks/use-cited-passages"
import { useTaskChecks } from "../hooks/use-task-checks"
import type { AppsHtml } from "../mcp-apps"
import { ChatMessageView } from "./ChatMessageView"

export type ReadOnlyConversationProps = {
  /** The conversation the messages belong to, which the documents of their sources belong to. */
  conversation: ConversationParamsDto
  messages: ConversationMessageOutputDto[]
  /** The current HTML of the replies' MCP Apps, which their owner loads. */
  appsHtml: AppsHtml
}

/**
 * A conversation as its owner saw it, only to read, as a reviewer reads a tester's session: the
 * chat's own messages, with their steps, sources, resources and apps, which run in the shared
 * sandbox, without the feedback, the ticks and the follow-up questions. A resource opens in a
 * new tab.
 */
export function ReadOnlyConversation({
  conversation,
  messages,
  appsHtml,
}: ReadOnlyConversationProps) {
  const chatMessages = toChatMessages(messages)
  const now = useNow(RELATIVE_TIME_INTERVAL_IN_MILLISECONDS, true)
  const [messageLayer, setMessageLayer] = useState<HTMLElement | null>(null)
  const taskChecks = useTaskChecks(chatMessages)
  const citedPassages = useCitedPassages(chatMessages, messageLayer)
  return (
    <ol ref={setMessageLayer} className="flex flex-col gap-6">
      {chatMessages.map((message) => (
        <li key={message.id}>
          <ChatMessageView
            conversation={conversation}
            message={message}
            now={now}
            hasSourcesTool
            appsHtml={appsHtml}
            // An app proposes a message to send: there is no message box to read it.
            onAppMessage={() => {}}
            onOpenResource={(resource) => window.open(resource.url, "_blank", "noopener")}
            citedPassages={citedPassages}
            taskChecks={taskChecks}
            followUpQuestions={[]}
            onFollowUpQuestion={() => {}}
            isReadOnly
          />
        </li>
      ))}
    </ol>
  )
}
