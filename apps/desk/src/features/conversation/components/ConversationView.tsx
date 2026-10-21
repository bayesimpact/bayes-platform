import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { ArrowDownIcon, RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { useSendMessage } from "../api/mutations"
import { messagesQueryOptions } from "../api/queries"
import { findRetryableContent, isWriting } from "../chat-messages"
import type { ConversationRef } from "../conversation-ref"
import { ChatMessageView } from "./ChatMessageView"
import { Composer } from "./Composer"

export type ConversationViewProps = {
  conversation: ConversationRef
  agentName: string
}

/**
 * A conversation, as the shadcn Chat: the messages in a scroller that follows the reply while the
 * person stays at the end, and the message box under it.
 */
export function ConversationView({ conversation, agentName }: ConversationViewProps) {
  const { t } = useLingui()
  const { data: messages } = useSuspenseQuery(messagesQueryOptions(conversation))
  const sendMessage = useSendMessage(conversation)
  const now = Date.now()
  const isBusy = sendMessage.isPending || messages.some((message) => isWriting(message, now))
  const retryableContent = isBusy ? null : findRetryableContent(messages, now)

  return (
    <MessageScrollerProvider autoScroll>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          {messages.length === 0 ? (
            <h1 className="mt-24 text-center text-3xl font-semibold tracking-tight">
              <Trans>How can I help you today?</Trans>
            </h1>
          ) : (
            <MessageScroller>
              <MessageScrollerViewport>
                <MessageScrollerContent
                  aria-busy={isBusy}
                  className="mx-auto w-full max-w-3xl px-4 py-6"
                >
                  {messages.map((message) => (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor={message.role === "user"}
                    >
                      <ChatMessageView message={message} now={now} />
                    </MessageScrollerItem>
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
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton>
                <ArrowDownIcon aria-hidden />
                <span className="sr-only">{t`Scroll to the latest message`}</span>
              </MessageScrollerButton>
            </MessageScroller>
          )}
        </div>
        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          <Composer
            agentName={agentName}
            isBusy={isBusy}
            onSend={(content) => sendMessage.mutate(content)}
          />
        </div>
      </div>
    </MessageScrollerProvider>
  )
}
