import { Button } from "@caseai-connect/ui/shad/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@caseai-connect/ui/shad/collapsible"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@caseai-connect/ui/shad/message-scroller"
import { cn } from "@caseai-connect/ui/utils"
import { ChevronDownIcon, FileCheckIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import type {
  FormAgentSession,
  FormSubSession,
} from "@/common/features/agents/agent-sessions/form/form-agent-sessions.models"
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
import { FormSubSessionsProvider } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/form-sub-sessions-context"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { AttachDocument } from "@/studio/features/documents/components/AttachDocument"
import { selectStreaming } from "../agent-session-messages.selectors"
import { sendMessage } from "../agent-session-messages.thunks"

type AgentSession = ConversationAgentSession | FormAgentSession

export function AgentSessionMessages({
  session,
  messages,
  rightSlot,
  onFillFormToolEvent,
  formSubSessions = [],
}: {
  rightSlot?: React.ReactNode
  session: AgentSession
  messages: AgentSessionMessageType[]
  onFillFormToolEvent?: () => void
  formSubSessions?: FormSubSession[]
}) {
  const isStreaming = useAppSelector(selectStreaming)
  const { t } = useTranslation()

  const desktopHeightClasses = "md:h-[calc(100dvh-17rem)]"
  return (
    <div className={cn("flex flex-1 flex-col md:flex-row min-h-0", desktopHeightClasses)}>
      {rightSlot && (
        <>
          {/* mobile: collapsible strip above the chat */}
          <Collapsible className="md:hidden w-full shrink-0 border-b bg-white">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium"
              >
                <span>{t("formAgentSession:props.result")}</span>
                <ChevronDownIcon className="size-4 transition-transform [[data-state=open]_&]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="relative h-40 overflow-hidden">{rightSlot}</div>
            </CollapsibleContent>
          </Collapsible>
          {/* desktop: fixed sidebar */}
          <div className="hidden md:block w-80 shrink-0 order-last h-full border-l bg-white relative overflow-hidden">
            {rightSlot}
          </div>
        </>
      )}
      <div className="flex flex-1 p-2 sm:p-4 min-h-0 md:min-h-full">
        <Chat className="border shadow-none">
          <FormSubSessionsProvider value={formSubSessions}>
            <Messages messages={messages} />
          </FormSubSessionsProvider>

          <Footer
            session={session}
            isStreaming={isStreaming}
            onFillFormToolEvent={onFillFormToolEvent}
          />
        </Chat>
      </div>
    </div>
  )
}

function Messages({ messages }: { messages: AgentSessionMessageType[] }) {
  const lastMessageIndex = (messages?.length ?? 0) - 1
  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <MessageScroller className="flex-1">
        <MessageScrollerViewport className="p-6">
          <MessageScrollerContent className="gap-4">
            {messages?.map((message, messageIndex) => (
              <MessageScrollerItem
                key={message.id}
                messageId={message.id}
                scrollAnchor={messageIndex === lastMessageIndex}
              >
                <AgentSessionMessage message={message} />
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton className="shadow-md" direction="end" />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

function Footer({
  session,
  isStreaming,
  onFillFormToolEvent,
}: {
  session: ConversationAgentSession
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
          {/* <Button variant="secondary" disabled={isStreaming || !session}>
            <CirclePlusIcon />
          </Button> */}

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
        </div>
        <ChatSubmit variant="ghost" disabled={isStreaming || !session} />
      </ChatActions>
    </ChatFooter>
  )
}
