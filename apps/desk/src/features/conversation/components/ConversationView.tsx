import type { ConversationParamsDto } from "@caseai-connect/desk-contracts"
import { Trans } from "@lingui/react/macro"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { ArrowDownIcon, RotateCcwIcon } from "lucide-react"
import { useId, useState } from "react"
import { HeaderActions } from "@/components/shared/HeaderActions"
import { Button } from "@/components/ui/button"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { MemoryButton, MemoryPanel } from "@/features/memory"
import { useNow } from "@/hooks/use-now"
import { ANNOTATION_LAYER_ATTRIBUTE } from "../annotation"
import { mcpAppsHtmlQueryOptions, messagesQueryOptions } from "../api/queries"
import { findRetryableMessage, isBeingWritten } from "../chat-messages"
import { useConversationForms } from "../hooks/use-conversation-forms"
import { useConversationPanel } from "../hooks/use-conversation-panel"
import { useConversationSend } from "../hooks/use-conversation-send"
import { ChatMessageView } from "./ChatMessageView"
import { Composer } from "./Composer"
import { ConversationMenu } from "./ConversationMenu"
import { FormsButton } from "./FormsButton"
import { FormsPanel } from "./FormsPanel"
import { QuoteReplyPopover } from "./QuoteReplyPopover"
import { ResourcePanel } from "./ResourcePanel"

/** The times of a conversation read in minutes: its clock moves once a minute. */
const CLOCK_INTERVAL_IN_MILLISECONDS = 60_000

export type ConversationViewProps = {
  conversation: ConversationParamsDto
  agentName: string
  /** Whether the project shows the sources of a reply (its `sources-tool` feature). */
  hasSourcesTool: boolean
}

/**
 * A conversation, as the shadcn Chat: the messages in a scroller that follows the reply while the
 * person stays at the end, and the message box under it.
 */
export function ConversationView({
  conversation,
  agentName,
  hasSourcesTool,
}: ConversationViewProps) {
  const { data: messages } = useSuspenseQuery(messagesQueryOptions(conversation))
  const sending = useConversationSend(conversation)
  const now = useNow(CLOCK_INTERVAL_IN_MILLISECONDS, true)
  const isBusy = sending.isSending || messages.some((message) => isBeingWritten(message, now))
  const retryableMessage = isBusy ? null : findRetryableMessage(messages, now)
  const forms = useConversationForms(conversation)
  const [draft, setDraft] = useState("")
  const composerId = useId()
  const panel = useConversationPanel()
  const hasSettledApps = messages.some(
    (message) => message.mcpApps.length > 0 && message.status !== "streaming",
  )
  // useQuery: optional data, read once a reply shows an MCP App, which must not hold it back.
  const mcpAppsHtml = useQuery({
    ...mcpAppsHtmlQueryOptions(conversation),
    enabled: hasSettledApps,
  })
  const appsHtml = { htmls: mcpAppsHtml.data ?? [], isPending: mcpAppsHtml.isPending }

  return (
    <MessageScrollerProvider autoScroll>
      <HeaderActions>
        <MemoryButton
          agent={conversation}
          isOpen={panel.isMemoryOpen}
          onToggle={() => panel.toggle("memory")}
        />
        {forms.length > 0 ? (
          <FormsButton
            forms={forms}
            isOpen={panel.isFormsOpen}
            onToggle={() => panel.toggle("forms")}
          />
        ) : null}
        <ConversationMenu conversation={conversation} />
      </HeaderActions>
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            {messages.length === 0 ? (
              <h1 className="mt-24 text-center text-3xl font-semibold tracking-tight">
                <Trans>How can I help you today?</Trans>
              </h1>
            ) : (
              <QuoteReplyPopover
                annotations={sending.annotations}
                onSave={sending.saveAnnotation}
                messageBoxId={composerId}
              >
                <MessageScroller>
                  <MessageScrollerViewport>
                    {/*
                      The numbers of annotations are drawn around the list, which counts its
                      children to scroll to a new message, and fills the height in its place.
                    */}
                    <div
                      className="relative flex h-max min-h-full flex-col"
                      {...{ [ANNOTATION_LAYER_ATTRIBUTE]: "" }}
                    >
                      {/* The first line stands clear of the bar's fade, with the number of an
                          annotation raised above it. */}
                      <MessageScrollerContent
                        aria-busy={isBusy}
                        className="mx-auto w-full max-w-3xl flex-1 gap-0 px-4 pt-10 pb-6"
                      >
                        {messages.map((message, position) => (
                          <MessageScrollerItem
                            // A message keeps its element when its id changes: the reply takes
                            // the server's id at its start, and the saved messages replace the
                            // local ones once it ends. A new element would read, to the scroller,
                            // as a new message to scroll to. A conversation only grows at its end.
                            // biome-ignore lint/suspicious/noArrayIndexKey: see above.
                            key={position}
                            messageId={message.id}
                            scrollAnchor={message.role === "user"}
                          >
                            <ChatMessageView
                              conversation={conversation}
                              message={message}
                              now={now}
                              hasSourcesTool={hasSourcesTool}
                              appsHtml={appsHtml}
                              onAppMessage={setDraft}
                              onOpenResource={panel.openResource}
                            />
                          </MessageScrollerItem>
                        ))}
                        {retryableMessage !== null ? (
                          <div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => sending.retry(retryableMessage)}
                            >
                              <RotateCcwIcon data-icon="inline-start" aria-hidden />
                              <Trans>Retry</Trans>
                            </Button>
                          </div>
                        ) : null}
                      </MessageScrollerContent>
                    </div>
                  </MessageScrollerViewport>
                  <MessageScrollerButton>
                    <ArrowDownIcon aria-hidden />
                    <span className="sr-only">
                      <Trans>Scroll to the latest message</Trans>
                    </span>
                  </MessageScrollerButton>
                </MessageScroller>
              </QuoteReplyPopover>
            )}
          </div>
          <div className="mx-auto w-full max-w-3xl px-4 pb-4">
            <Composer
              agentName={agentName}
              inputId={composerId}
              content={draft}
              onContentChange={setDraft}
              isBusy={isBusy}
              annotationCount={sending.annotations.length}
              onSend={sending.send}
            />
          </div>
        </div>
        {panel.isMemoryOpen ? <MemoryPanel agent={conversation} onClose={panel.close} /> : null}
        {panel.isFormsOpen && forms.length > 0 ? (
          <FormsPanel forms={forms} onClose={panel.close} />
        ) : null}
        {panel.openedResource ? (
          <ResourcePanel
            key={panel.openedResource.url}
            resource={panel.openedResource}
            onClose={panel.close}
          />
        ) : null}
      </div>
    </MessageScrollerProvider>
  )
}
