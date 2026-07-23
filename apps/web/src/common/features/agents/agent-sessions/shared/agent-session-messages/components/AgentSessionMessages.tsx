import { Button } from "@caseai-connect/ui/shad/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@caseai-connect/ui/shad/command"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
  useMessageScrollerVisibility,
} from "@caseai-connect/ui/shad/message-scroller"
import { Popover, PopoverContent, PopoverTrigger } from "@caseai-connect/ui/shad/popover"
import { cn } from "@caseai-connect/ui/utils"
import { FileCheckIcon, ListIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type {
  ConversationAgentSession,
  ConversationSubSession,
} from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import type { AgentSessionMessage as AgentSessionMessageType } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.models"
import { AgentSessionMessage } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/AgentSessionMessage"
import {
  Chat,
  ChatActions,
  ChatFooter,
  ChatInput,
  ChatSubmit,
} from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/Chat"
import { Dictaphone } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/Dictaphone"
import { FormResultProvider } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/form-result-context"
import { FormSubSessionsProvider } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/form-sub-sessions-context"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { AttachDocument } from "@/studio/features/documents/components/AttachDocument"
import { selectStreaming } from "../agent-session-messages.selectors"
import { sendMessage } from "../agent-session-messages.thunks"

type AgentSession = ConversationAgentSession

export function AgentSessionMessages({
  session,
  messages,
  onFillFormToolEvent,
  formSubSessions = [],
  formResultSchema,
}: {
  session: AgentSession
  messages: AgentSessionMessageType[]
  onFillFormToolEvent?: () => void
  formSubSessions?: ConversationSubSession[]
  formResultSchema?: Record<string, unknown>
}) {
  const isStreaming = useAppSelector(selectStreaming)

  const formResult = formResultSchema
    ? { outputJsonSchema: formResultSchema, result: session.result }
    : null

  const desktopHeightClasses = "md:h-[calc(100dvh-17rem)]"
  return (
    <div className={cn("flex flex-1 flex-col min-h-0", desktopHeightClasses)}>
      <div className="flex flex-1 p-2 sm:p-4 min-h-0 md:min-h-full">
        <Chat className="border shadow-none">
          <MessageScrollerProvider scrollPreviousItemPeek={168} defaultScrollPosition="end">
            <FormSubSessionsProvider value={formSubSessions}>
              <FormResultProvider value={formResult}>
                <Messages messages={messages} />
              </FormResultProvider>
            </FormSubSessionsProvider>

            <Footer
              session={session}
              messages={messages}
              isStreaming={isStreaming}
              onFillFormToolEvent={onFillFormToolEvent}
            />
          </MessageScrollerProvider>
        </Chat>
      </div>
    </div>
  )
}

function Messages({ messages }: { messages: AgentSessionMessageType[] }) {
  return (
    <MessageScroller className="flex-1">
      <MessageScrollerViewport className="p-6">
        <MessageScrollerContent className="gap-4">
          {messages.map((message, index) => (
            <MessageScrollerItem
              key={index.toString()}
              messageId={message.id}
              // Anchor on user turns so jumps land on a question with prior context peeking above.
              scrollAnchor={message.role === "user"}
            >
              <AgentSessionMessage message={message} />
            </MessageScrollerItem>
          ))}
        </MessageScrollerContent>
      </MessageScrollerViewport>
      <MessageScrollerButton className="shadow-md" direction="end" />
    </MessageScroller>
  )
}

/**
 * "Jump to a message" navigator: a searchable popover listing every user prompt in the
 * thread. Selecting one drives the transcript via `scrollToMessage`; the turn currently in
 * view is highlighted through `useMessageScrollerVisibility`.
 */
function MessageNavigator({ messages }: { messages: AgentSessionMessageType[] }) {
  const { t } = useTranslation("agentSessionMessage")
  const { scrollToMessage } = useMessageScroller()
  const { currentAnchorId } = useMessageScrollerVisibility()
  const [open, setOpen] = useState(false)

  const userMessages = messages?.filter((message) => message.role === "user") ?? []

  // Not worth the affordance for a single-turn thread.
  if (userMessages.length < 2) return null

  const handleJump = (messageId: string) => {
    scrollToMessage(messageId)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          aria-label={t("navigator.trigger")}
          className="data-[state=open]:bg-muted"
        >
          <ListIcon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder={t("navigator.search")} />
          <CommandList>
            <CommandEmpty>{t("navigator.empty")}</CommandEmpty>
            <CommandGroup heading={t("navigator.title")}>
              {userMessages.map((message, index) => (
                <CommandItem
                  key={index.toString()}
                  // Search by content, but keep a stable unique value so cmdk can't collapse
                  // two identically-worded prompts into one row.
                  value={message.id}
                  keywords={[message.content]}
                  onSelect={() => handleJump(message.id)}
                  className={cn(
                    "cursor-pointer",
                    currentAnchorId === message.id && "bg-muted font-medium",
                  )}
                >
                  <span className="truncate">{message.content}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function Footer({
  session,
  messages,
  isStreaming,
  onFillFormToolEvent,
}: {
  session: ConversationAgentSession
  messages: AgentSessionMessageType[]
  isStreaming: boolean
  onFillFormToolEvent?: () => void
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const [file, setFile] = useState<File>()

  const handleAttachDocument = (attachedFile: File) => setFile(attachedFile)
  const handleUnattachDocument = () => setFile(undefined)

  const handleSubmit = (message: string) => {
    const trimmedMessage = message.trim()
    if (isStreaming || !trimmedMessage) return
    void dispatch(sendMessage({ content: trimmedMessage, file, onFillFormToolEvent }))
    handleUnattachDocument()
  }

  return (
    <ChatFooter focus={!isStreaming} onMessageSubmit={handleSubmit}>
      <ChatInput
        placeholder={t("conversationAgentSession:chat.placeholder")}
        className="resize-none"
        disabled={isStreaming || !session}
      />

      <ChatActions>
        <div className="flex-1 justify-start flex gap-1">
          <div className="flex items-center gap-1">
            <AttachDocument onAttach={handleAttachDocument} disabled={isStreaming || !session} />
            {file && (
              <Button variant="default" onClick={handleUnattachDocument}>
                <FileCheckIcon className="size-4" /> {file?.name}
                <XIcon className="size-4" />
              </Button>
            )}
          </div>

          <Dictaphone disabled={isStreaming || !session} />
          <MessageNavigator messages={messages} />
        </div>
        <ChatSubmit variant="ghost" disabled={isStreaming || !session} />
      </ChatActions>
    </ChatFooter>
  )
}
