import type {
  AgentSessionMcpAppHtmlDto,
  AgentSessionMessageDto,
  EmbedDisplayMode,
} from "@bayes-platform/api-contracts"
import { useEffect, useMemo, useRef, useState } from "react"
import { I18nextProvider, useTranslation } from "react-i18next"
import type { SupportedLocale } from "../i18n"
import { createEmbedI18n } from "../i18n"
import {
  Chat,
  ChatActions,
  ChatBanner,
  ChatContent,
  ChatFooter,
  ChatHeader,
  ChatInput,
  ChatMessage,
  ChatSubmit,
} from "./components"
import { followUpReplyIndex } from "./components/FollowUpQuestions"
import { useScrollToEnd } from "./hooks/use-scroll-to-end"

export type EmbedChatTheme = {
  /** Primary brand colour — hex, rgb, hsl, oklch, or any valid CSS colour value */
  primaryColor?: string
  /** URL of the logo image shown in the chat header. Falls back to a sparkle icon. */
  logoUrl?: string
}

export type EmbedChatProps = {
  /** Display name shown in the chat header */
  agentName?: string
  /** Visual theme overrides */
  theme?: EmbedChatTheme
  /** UI language. Defaults to "en". */
  locale?: SupportedLocale
  /** Controls how the chat container is presented. "modal" uses rounded corners; "drawer" fills its container edge-to-edge. */
  displayMode?: EmbedDisplayMode
  /** All messages to display, in order */
  messages: AgentSessionMessageDto[]
  /** Current HTML of the MCP App cards in the thread, loaded after the messages. */
  mcpAppHtml?: AgentSessionMcpAppHtmlDto[]
  /** The MCP servers have not answered yet: cards without HTML show a placeholder. */
  isMcpAppHtmlLoading?: boolean
  /** Whether the assistant is currently streaming a response */
  isStreaming: boolean
  /** Called when the user submits a message */
  onSendMessage: (content: string) => void
  /** Overrides the translated placeholder text in the input */
  placeholder?: string
  /** Called when the user clicks the close button in the header */
  onClose?: () => void
  /** Called when the user clicks the new conversation button in the header */
  onNewConversation?: () => void
  /** Hide the branded header (agent name, logo, new conversation, close). Useful when the host already has chrome. */
  hideHeader?: boolean
  /** Optional notice pinned above the conversation (e.g. "Test version, staff only"). */
  bannerText?: string
  /** The previous conversation expired: say so above the new one until the next message. */
  isPreviousSessionExpired?: boolean
}

export function EmbedChat(props: EmbedChatProps) {
  const { locale = "en" } = props

  // One i18n instance per widget — never touches the global singleton.
  const i18n = useMemo(() => createEmbedI18n(locale), [locale])

  // Sync language changes after mount.
  useEffect(() => {
    void i18n.changeLanguage(locale)
  }, [locale, i18n])

  return (
    <I18nextProvider i18n={i18n}>
      <EmbedChatInner {...props} />
    </I18nextProvider>
  )
}

function EmbedChatInner({
  agentName,
  theme,
  displayMode = "modal",
  messages,
  mcpAppHtml = [],
  isMcpAppHtmlLoading = false,
  isStreaming,
  onSendMessage,
  placeholder,
  onClose,
  onNewConversation,
  hideHeader = false,
  bannerText,
  isPreviousSessionExpired = false,
}: EmbedChatProps) {
  const { t } = useTranslation("chat")
  const chatEndRef = useRef<HTMLDivElement>(null)
  const scrollToEndInstant = useScrollToEnd(chatEndRef, "instant")
  const scrollToEndSmooth = useScrollToEnd(chatEndRef, "smooth")

  // Follow the conversation down as it grows: a new message, a streaming chunk, cards that load
  // after the text. Content that grows by itself (a card's height, an image) sends no new
  // messages, so a ResizeObserver watches the thread. A visitor who scrolled up to read is left
  // where they are until they come back near the end.
  const isFollowingRef = useRef(true)
  useEffect(() => {
    const end = chatEndRef.current
    const thread = end?.parentElement
    if (!thread) return
    const onScroll = () => {
      isFollowingRef.current = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80
    }
    thread.addEventListener("scroll", onScroll, { passive: true })
    // Scroll the thread itself: scrollIntoView would also scroll the host page around the chat.
    const observer = new ResizeObserver(() => {
      if (isFollowingRef.current) thread.scrollTop = thread.scrollHeight
    })
    for (const child of Array.from(thread.children)) observer.observe(child)
    const mutations = new MutationObserver(() => {
      observer.disconnect()
      for (const child of Array.from(thread.children)) observer.observe(child)
    })
    mutations.observe(thread, { childList: true })
    return () => {
      thread.removeEventListener("scroll", onScroll)
      observer.disconnect()
      mutations.disconnect()
    }
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on each change to the thread
  useEffect(() => {
    if (!isFollowingRef.current) return
    if (isStreaming) scrollToEndSmooth()
    else scrollToEndInstant()
  }, [messages, isStreaming, scrollToEndInstant, scrollToEndSmooth])

  const followUpIndex = followUpReplyIndex(messages)

  // A new conversation wipes the one on screen for good: once the visitor has written something,
  // the header button asks first.
  const [isConfirmingNewConversation, setIsConfirmingNewConversation] = useState(false)
  const hasVisitorWritten = messages.some((message) => message.role === "user")
  const requestNewConversation = onNewConversation
    ? () => (hasVisitorWritten ? setIsConfirmingNewConversation(true) : onNewConversation())
    : undefined

  // The visitor can write while a reply is coming. What they send then waits, shown greyed in
  // the thread, and goes out as one message once the reply is over.
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null)
  const handleSendMessage = (content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return
    if (isStreaming) {
      setQueuedMessage((queued) => (queued ? `${queued}\n\n${trimmed}` : trimmed))
      return
    }
    isFollowingRef.current = true
    onSendMessage(trimmed)
  }
  useEffect(() => {
    if (isStreaming || !queuedMessage) return
    setQueuedMessage(null)
    isFollowingRef.current = true
    onSendMessage(queuedMessage)
  }, [isStreaming, queuedMessage, onSendMessage])

  return (
    <Chat primaryColor={theme?.primaryColor} displayMode={displayMode}>
      {!hideHeader && (
        <ChatHeader
          agentName={agentName}
          logoUrl={theme?.logoUrl}
          onClose={onClose}
          collapsible={displayMode === "modal"}
          onNewConversation={requestNewConversation}
        />
      )}

      {isConfirmingNewConversation && onNewConversation && (
        <NewConversationConfirm
          onCancel={() => setIsConfirmingNewConversation(false)}
          onConfirm={() => {
            setIsConfirmingNewConversation(false)
            setQueuedMessage(null)
            onNewConversation()
          }}
        />
      )}

      {bannerText && <ChatBanner text={bannerText} />}

      <ChatContent>
        {isPreviousSessionExpired && (
          <p role="note" className="text-center text-xs text-gray-500">
            {t("status.sessionExpired")}
          </p>
        )}
        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            mcpAppHtml={mcpAppHtml}
            isMcpAppHtmlLoading={isMcpAppHtmlLoading}
            // Only the last reply keeps its suggested questions: a new message hides them.
            onFollowUpSelect={
              !isStreaming && index === followUpIndex ? handleSendMessage : undefined
            }
          />
        ))}
        {queuedMessage && (
          <div data-slot="chat-queued-message" className="flex w-full flex-col items-end gap-1">
            <div
              className="max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[var(--embed-on-primary)] text-sm opacity-50"
              style={{ backgroundColor: "var(--embed-primary)" }}
            >
              {queuedMessage}
            </div>
            <span className="text-gray-500 text-xs">{t("message.queued")}</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </ChatContent>

      <ChatFooter onMessageSubmit={handleSendMessage}>
        <ChatInput placeholder={placeholder ?? t("input.placeholder")} className="resize-none" />
        <ChatActions>
          <ChatSubmit aria-label={t("input.submitAriaLabel")} />
        </ChatActions>
      </ChatFooter>
    </Chat>
  )
}

function NewConversationConfirm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation("chat")
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onCancel])

  return (
    <div
      role="alertdialog"
      aria-labelledby="embed-new-conversation-title"
      aria-describedby="embed-new-conversation-text"
      className="embed-confirm shrink-0 border-gray-200 border-b bg-white px-5 py-4 shadow-sm"
    >
      <p id="embed-new-conversation-title" className="font-medium text-gray-900 text-sm">
        {t("newConversation.title")}
      </p>
      <p id="embed-new-conversation-text" className="mt-1 text-gray-500 text-sm">
        {t("newConversation.text")}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          className="rounded-full px-4 py-1.5 font-medium text-gray-700 text-sm transition hover:bg-gray-100"
        >
          {t("newConversation.cancel")}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-full px-4 py-1.5 font-medium text-[var(--embed-on-primary)] text-sm transition hover:opacity-90"
          style={{ backgroundColor: "var(--embed-primary)" }}
        >
          {t("newConversation.confirm")}
        </button>
      </div>
    </div>
  )
}
