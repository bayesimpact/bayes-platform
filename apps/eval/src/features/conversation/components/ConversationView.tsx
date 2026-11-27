import { Button } from "@caseai-connect/app-ui/components/button"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@caseai-connect/app-ui/components/message-scroller"
import { HeaderActions } from "@caseai-connect/app-ui/compositions/HeaderActions"
import {
  ANNOTATION_LAYER_ATTRIBUTE,
  findRetryableMessage,
  isBeingWritten,
  lastReplyFollowUpQuestions,
  useChat,
  useCitedPassages,
  useConversationSend,
  withAppMessage,
} from "@caseai-connect/chat"
import type {
  ConversationFormOutputDto,
  ConversationParamsDto,
} from "@caseai-connect/eval-contracts"
import { useNow } from "@caseai-connect/frontend-lib"
import { Trans } from "@lingui/react/macro"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { ArrowDownIcon, RotateCcwIcon } from "lucide-react"
import { type ReactNode, useId, useState } from "react"
import { useConversationPanel } from "../hooks/use-conversation-panel"
import { ChatMessageView } from "./ChatMessageView"
import { CitedPassageBadges } from "./CitedPassageBadges"
import { Composer } from "./Composer"
import { FormsButton } from "./FormsButton"
import { FormsPanel } from "./FormsPanel"
import { QuoteReplyPopover } from "./QuoteReplyPopover"
import { ResourcePanel } from "./ResourcePanel"

/** The times of a conversation read in minutes: its clock moves once a minute. */
const CLOCK_INTERVAL_IN_MILLISECONDS = 60_000

export type ConversationViewProps = {
  conversation: ConversationParamsDto
  agentName: string
  /** The forms the agents filled in during the conversation, which its owner loads. */
  forms: ConversationFormOutputDto[]
  /** What the bar above the conversation shows before its own buttons, such as a way to end it. */
  headerActions?: ReactNode
  /**
   * A panel of the owner docked beside the conversation, such as the feedback that ends it. While
   * it shows, it takes the place of the conversation's own panels.
   */
  sidePanel?: ReactNode
  /** Called when the conversation opens one of its own panels: the owner then closes its own. */
  onSidePanelDismiss?: () => void
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
  forms,
  headerActions,
  sidePanel = null,
  onSidePanelDismiss,
  hasSourcesTool,
}: ConversationViewProps) {
  const chat = useChat()
  const { data: messages } = useSuspenseQuery(chat.messagesQueryOptions(conversation))
  const sending = useConversationSend(conversation, messages)
  const now = useNow(CLOCK_INTERVAL_IN_MILLISECONDS, true)
  const isBusy = sending.isSending || messages.some((message) => isBeingWritten(message, now))
  const retryableMessage = isBusy ? null : findRetryableMessage(messages, now)
  const followUpQuestions = lastReplyFollowUpQuestions(messages, isBusy)
  const lastPosition = messages.length - 1
  const [draft, setDraft] = useState("")
  const composerId = useId()
  const panel = useConversationPanel()
  // The element the messages render in, where the passages they quote are found.
  const [messageLayer, setMessageLayer] = useState<HTMLElement | null>(null)
  const citedPassages = useCitedPassages(messages, messageLayer)
  const hasSettledApps = messages.some(
    (message) => message.mcpApps.length > 0 && message.status !== "streaming",
  )
  // useQuery: optional data, read once a reply shows an MCP App, which must not hold it back.
  const mcpAppsHtml = useQuery({
    ...chat.mcpAppsHtmlQueryOptions(conversation),
    enabled: hasSettledApps,
  })
  const appsHtml = { htmls: mcpAppsHtml.data ?? [], isPending: mcpAppsHtml.isPending }
  // The buttons of the questions go away once one is sent: the focus moves to the message box,
  // so a keyboard user does not start again from the top of the page.
  const handleFollowUpQuestion = (question: string) => {
    sending.send({ content: question, attachment: null })
    document.getElementById(composerId)?.focus()
  }
  // An app's message joins what the person wrote, and the focus goes to the box to send it.
  const handleAppMessage = (text: string) => {
    setDraft((current) => withAppMessage(current, text))
    document.getElementById(composerId)?.focus()
  }

  return (
    <MessageScrollerProvider autoScroll>
      <HeaderActions>
        {headerActions}
        {forms.length > 0 ? (
          <FormsButton
            forms={forms}
            isOpen={panel.isFormsOpen && sidePanel === null}
            onToggle={() => {
              // With the owner's panel in the way, the button shows the forms in its place.
              if (sidePanel === null || !panel.isFormsOpen) panel.toggle("forms")
              onSidePanelDismiss?.()
            }}
          />
        ) : null}
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
                firstNumber={citedPassages.nextNumber}
                onReplyClick={citedPassages.showChipAt}
              >
                {messageLayer ? (
                  <CitedPassageBadges citedPassages={citedPassages} layer={messageLayer} />
                ) : null}
                <MessageScroller>
                  <MessageScrollerViewport>
                    {/*
                      The numbers of annotations are drawn around the list, which counts its
                      children to scroll to a new message, and fills the height in its place.
                    */}
                    <div
                      ref={setMessageLayer}
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
                              onAppMessage={handleAppMessage}
                              onOpenResource={(resource) => {
                                panel.openResource(resource)
                                onSidePanelDismiss?.()
                              }}
                              citedPassages={citedPassages}
                              taskChecks={sending.taskChecks}
                              followUpQuestions={position === lastPosition ? followUpQuestions : []}
                              onFollowUpQuestion={handleFollowUpQuestion}
                            />
                          </MessageScrollerItem>
                        ))}
                        {retryableMessage !== null ? (
                          <div className="mt-3">
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
              taskCount={sending.taskChecks.pending.length}
              onSend={sending.send}
            />
          </div>
        </div>
        {sidePanel}
        {sidePanel === null && panel.isFormsOpen && forms.length > 0 ? (
          <FormsPanel forms={forms} onClose={panel.close} />
        ) : null}
        {sidePanel === null && panel.openedResource ? (
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
