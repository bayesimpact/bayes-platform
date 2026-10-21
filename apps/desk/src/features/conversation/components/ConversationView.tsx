import { Trans, useLingui } from "@lingui/react/macro"
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
import { ANNOTATION_LAYER_ATTRIBUTE, composeMessage } from "../annotation"
import { useSendMessage } from "../api/mutations"
import { mcpAppsHtmlQueryOptions, messagesQueryOptions } from "../api/queries"
import { findRetryableMessage, isWriting } from "../chat-messages"
import type { ConversationRef } from "../conversation-ref"
import { useAnnotations } from "../hooks/use-annotations"
import { useConversationForms } from "../hooks/use-conversation-forms"
import type { PlayedVideo } from "../resource-media"
import { ChatMessageView } from "./ChatMessageView"
import { Composer } from "./Composer"
import { FormsButton } from "./FormsButton"
import { FormsPanel } from "./FormsPanel"
import { QuoteReplyPopover } from "./QuoteReplyPopover"
import { VideoPanel } from "./VideoPanel"

export type ConversationViewProps = {
  conversation: ConversationRef
  agentName: string
  /** Whether the project shows the sources of a reply (its `sources-tool` feature). */
  showSources: boolean
}

/**
 * A conversation, as the shadcn Chat: the messages in a scroller that follows the reply while the
 * person stays at the end, and the message box under it.
 */
export function ConversationView({ conversation, agentName, showSources }: ConversationViewProps) {
  const { t } = useLingui()
  const { data: messages } = useSuspenseQuery(messagesQueryOptions(conversation))
  const sendMessage = useSendMessage(conversation)
  const now = Date.now()
  const isBusy = sendMessage.isPending || messages.some((message) => isWriting(message, now))
  const retryableMessage = isBusy ? null : findRetryableMessage(messages, now)
  const forms = useConversationForms(conversation)
  const [draft, setDraft] = useState("")
  const composerId = useId()
  const annotations = useAnnotations()
  // The panel docked beside the conversation, as an artifact in the Claude app, if one is open.
  const [openPanel, setOpenPanel] = useState<"memory" | "forms" | PlayedVideo | null>(null)
  const togglePanel = (panel: "memory" | "forms") =>
    setOpenPanel((current) => (current === panel ? null : panel))
  const playedVideo = typeof openPanel === "object" ? openPanel : null
  const memoryAgent = {
    organizationId: conversation.organizationId,
    projectId: conversation.projectId,
    agentId: conversation.agentId,
  }
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
          agent={memoryAgent}
          isOpen={openPanel === "memory"}
          onToggle={() => togglePanel("memory")}
        />
        {forms.length > 0 ? (
          <FormsButton
            forms={forms}
            isOpen={openPanel === "forms"}
            onToggle={() => togglePanel("forms")}
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
                annotations={annotations.annotations}
                onSave={annotations.save}
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
                        className="mx-auto w-full max-w-3xl flex-1 px-4 pt-10 pb-6"
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
                              showSources={showSources}
                              appsHtml={appsHtml}
                              onAppMessage={setDraft}
                              onPlayVideo={setOpenPanel}
                            />
                          </MessageScrollerItem>
                        ))}
                        {retryableMessage !== null ? (
                          <div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => sendMessage.mutate(retryableMessage)}
                            >
                              <RotateCcwIcon aria-hidden />
                              <Trans>Retry</Trans>
                            </Button>
                          </div>
                        ) : null}
                      </MessageScrollerContent>
                    </div>
                  </MessageScrollerViewport>
                  <MessageScrollerButton>
                    <ArrowDownIcon aria-hidden />
                    <span className="sr-only">{t`Scroll to the latest message`}</span>
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
              annotationCount={annotations.annotations.length}
              onSend={(outgoing) => {
                // The annotations leave with the message, each on a line of its own.
                const content = composeMessage(outgoing.content, annotations.annotations)
                sendMessage.mutate({ ...outgoing, content })
                annotations.clear()
              }}
            />
          </div>
        </div>
        {openPanel === "memory" ? (
          <MemoryPanel agent={memoryAgent} onClose={() => setOpenPanel(null)} />
        ) : null}
        {openPanel === "forms" && forms.length > 0 ? (
          <FormsPanel forms={forms} onClose={() => setOpenPanel(null)} />
        ) : null}
        {playedVideo ? (
          <VideoPanel
            key={playedVideo.videoId}
            video={playedVideo}
            onClose={() => setOpenPanel(null)}
          />
        ) : null}
      </div>
    </MessageScrollerProvider>
  )
}
