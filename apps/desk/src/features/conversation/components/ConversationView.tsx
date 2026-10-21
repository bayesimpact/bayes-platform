import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { ArrowDownIcon, RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSendMessage } from "../api/mutations"
import { messagesQueryOptions } from "../api/queries"
import { findRetryableContent, isWriting } from "../chat-messages"
import type { ConversationRef } from "../conversation-ref"
import { useStickToEnd } from "../hooks/use-stick-to-end"
import { ChatMessageView } from "./ChatMessageView"
import { Composer } from "./Composer"

export type ConversationViewProps = {
  conversation: ConversationRef
  agentName: string
}

/** A conversation: its messages, newest at the bottom, and the message box under them. */
export function ConversationView({ conversation, agentName }: ConversationViewProps) {
  const { t } = useLingui()
  const { data: messages } = useSuspenseQuery(messagesQueryOptions(conversation))
  const sendMessage = useSendMessage(conversation)
  const now = Date.now()
  const isBusy = sendMessage.isPending || messages.some((message) => isWriting(message, now))
  const retryableContent = isBusy ? null : findRetryableContent(messages, now)
  const lastMessage = messages.at(-1)
  const { endRef, isAtEnd, scrollToEnd } = useStickToEnd(
    `${messages.length}:${lastMessage?.content.length ?? 0}:${lastMessage?.toolNames.length ?? 0}`,
  )

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4">
      <div className="flex flex-1 flex-col gap-6 py-6">
        {messages.length === 0 ? (
          <h1 className="mt-16 text-center text-3xl font-semibold tracking-tight">
            <Trans>How can I help you today?</Trans>
          </h1>
        ) : null}
        {messages.map((message) => (
          <ChatMessageView key={message.id} message={message} now={now} />
        ))}
        {retryableContent !== null ? (
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendMessage.mutate(retryableContent)}
            >
              <RotateCcwIcon aria-hidden />
              <Trans>Retry</Trans>
            </Button>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      <div className="sticky bottom-0 bg-background pb-4">
        {isAtEnd ? null : (
          <Button
            variant="outline"
            size="icon-sm"
            className="absolute -top-10 left-1/2 -translate-x-1/2 rounded-full shadow-sm"
            aria-label={t`Scroll to the latest message`}
            onClick={scrollToEnd}
          >
            <ArrowDownIcon aria-hidden />
          </Button>
        )}
        <Composer
          agentName={agentName}
          isBusy={isBusy}
          onSend={(content) => sendMessage.mutate(content)}
        />
      </div>
    </div>
  )
}
