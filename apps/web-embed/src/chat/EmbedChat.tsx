import type { AgentSessionMessageDto } from "@caseai-connect/api-contracts"
import { useEffect, useMemo, useRef } from "react"
import { I18nextProvider, useTranslation } from "react-i18next"
import type { SupportedLocale } from "../i18n"
import { createEmbedI18n } from "../i18n"
import {
  Chat,
  ChatActions,
  ChatContent,
  ChatFooter,
  ChatHeader,
  ChatInput,
  ChatMessage,
  ChatSubmit,
} from "./components"
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
  /** All messages to display, in order */
  messages: AgentSessionMessageDto[]
  /** Whether the assistant is currently streaming a response */
  isStreaming: boolean
  /** Called when the user submits a message */
  onSendMessage: (content: string) => void
  /** Overrides the translated placeholder text in the input */
  placeholder?: string
  /** Called when the user clicks the close button in the header */
  onClose?: () => void
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
  messages,
  isStreaming,
  onSendMessage,
  placeholder,
  onClose,
}: EmbedChatProps) {
  const { t } = useTranslation("chat")
  const chatEndRef = useRef<HTMLDivElement>(null)
  const scrollToEndInstant = useScrollToEnd(chatEndRef, "instant")
  const scrollToEndSmooth = useScrollToEnd(chatEndRef, "smooth")

  // Scroll instantly on mount and whenever the message list changes (new user
  // message, streaming chunk, or session restore). Use smooth during streaming.
  useEffect(() => {
    scrollToEndInstant()
  }, [scrollToEndInstant])

  useEffect(() => {
    if (isStreaming) {
      scrollToEndSmooth()
    } else {
      scrollToEndInstant()
    }
  }, [isStreaming, scrollToEndInstant, scrollToEndSmooth])

  const handleSendMessage = (content: string) => {
    const trimmed = content.trim()
    if (!trimmed || isStreaming) return
    onSendMessage(trimmed)
  }

  return (
    <Chat primaryColor={theme?.primaryColor}>
      <ChatHeader agentName={agentName} logoUrl={theme?.logoUrl} onClose={onClose} />

      <ChatContent>
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        <div ref={chatEndRef} />
      </ChatContent>

      <ChatFooter focus={!isStreaming} onMessageSubmit={handleSendMessage}>
        <ChatInput
          placeholder={placeholder ?? t("input.placeholder")}
          disabled={isStreaming}
          className="resize-none"
        />
        <ChatActions>
          <ChatSubmit aria-label={t("input.submitAriaLabel")} disabled={isStreaming} />
        </ChatActions>
      </ChatFooter>
    </Chat>
  )
}
