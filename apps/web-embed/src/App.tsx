import type {
  AgentSessionMessageDto,
  EmbedDisplayMode,
  EmbedPublicConfigDto,
} from "@caseai-connect/api-contracts"
import { useEffect, useMemo, useRef, useState } from "react"
import { I18nextProvider, useTranslation } from "react-i18next"
import { getEmbedConfig } from "./api/public-chat-api"
import { shortConversation } from "./chat/chat.factory"
import type { EmbedChatTheme } from "./chat/EmbedChat"
import { EmbedChat } from "./chat/EmbedChat"
import type { PublicChatErrorKey } from "./hooks/usePublicChat"
import { usePublicChat } from "./hooks/usePublicChat"
import { createEmbedI18n, type SupportedLocale } from "./i18n"
import { readLinkTarget, sendLinksToParent } from "./open-link"
import { latestReplyOf, previewOf } from "./preview"
import { DEFAULT_PRIMARY_COLOR } from "./theme"

// ─── URL param helpers ─────────────────────────────────────────────────────

function readParam(key: string): string | undefined {
  return new URLSearchParams(window.location.search).get(key) ?? undefined
}

function readLocaleFromUrl(): SupportedLocale {
  return readParam("locale") === "fr" ? "fr" : "en"
}

function readDisplayModeFromUrl(): EmbedDisplayMode {
  return readParam("displayMode") === "drawer" ? "drawer" : "modal"
}

function readHideHeaderFromUrl(): boolean {
  const value = readParam("hideHeader")
  return value === "1" || value === "true"
}

function isResetSessionMessage(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === "agent-studio:reset-session"
  )
}

// ─── Root ──────────────────────────────────────────────────────────────────

export function App() {
  const locale = readLocaleFromUrl()
  const i18n = useMemo(() => createEmbedI18n(locale), [locale])

  // Keep the document language in sync with the widget locale so browsers
  // don't see an "English" page full of French content and offer to translate.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const embedToken = readParam("embedToken")
  const displayMode = readDisplayModeFromUrl()
  const hideHeader = readHideHeaderFromUrl()
  const linkTarget = readLinkTarget(window.location.search)

  useEffect(() => {
    if (linkTarget === "parent") return sendLinksToParent()
  }, [linkTarget])

  const handleClose = () => {
    window.parent.postMessage({ type: "agent-studio:close" }, "*")
  }

  return (
    <I18nextProvider i18n={i18n}>
      <div className="h-screen w-full">
        {embedToken ? (
          <LiveChat
            embedToken={embedToken}
            locale={locale}
            displayMode={displayMode}
            hideHeader={hideHeader}
            onClose={handleClose}
          />
        ) : (
          <SimulatedChat
            locale={locale}
            displayMode={displayMode}
            hideHeader={hideHeader}
            onClose={handleClose}
          />
        )}
      </div>
    </I18nextProvider>
  )
}

// ─── Live mode (real API) ──────────────────────────────────────────────────

function LiveChat({
  embedToken,
  locale,
  displayMode,
  hideHeader,
  onClose,
}: {
  embedToken: string
  locale: SupportedLocale
  displayMode: EmbedDisplayMode
  hideHeader: boolean
  onClose: () => void
}) {
  const [remoteConfig, setRemoteConfig] = useState<EmbedPublicConfigDto | null>(null)

  useEffect(() => {
    getEmbedConfig(embedToken)
      .then(setRemoteConfig)
      .catch(() => {
        // Config loading failed — we'll fall back to defaults in the chat UI
      })
  }, [embedToken])

  const theme: EmbedChatTheme = {
    primaryColor: remoteConfig?.primaryColor ?? undefined,
    logoUrl: remoteConfig?.logoUrl ?? undefined,
  }

  const {
    status,
    messages,
    mcpAppHtml,
    isMcpAppHtmlLoading,
    isStreaming,
    isPreviousSessionExpired,
    errorKey,
    send,
    reset,
  } = usePublicChat(embedToken)

  useLauncherPreview(
    status === "ready",
    messages,
    remoteConfig?.title ?? remoteConfig?.agentName ?? null,
  )

  // Once the visitor has written, the latest finished reply, so one that ends while the chat is
  // closed shows next to the button with a badge. It is the visitor's conversation, so only its
  // first words go, and only to the page that loaded the widget (its referrer); without one, the
  // launcher gets nothing.
  const reply = latestReplyOf(messages)
  const replyId = reply?.id ?? null
  const replyText = reply ? reply.text.slice(0, 200) : ""
  const hostOrigin = useMemo(() => {
    try {
      return document.referrer ? new URL(document.referrer).origin : null
    } catch {
      return null
    }
  }, [])
  // A reply already there when the chat loaded (a restored conversation) is not news.
  const restoredReplyId = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (status !== "ready") return
    if (restoredReplyId.current === undefined) restoredReplyId.current = replyId
    if (!replyId || !hostOrigin) return
    window.parent.postMessage(
      {
        type: "agent-studio:reply",
        id: replyId,
        text: replyText,
        isNew: replyId !== restoredReplyId.current,
      },
      hostOrigin,
    )
  }, [status, replyId, replyText, hostOrigin])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (isResetSessionMessage(event.data)) {
        reset()
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [reset])

  if (status === "initializing") {
    return <ChatLoadingShell theme={theme} hideHeader={hideHeader} />
  }

  if (status === "error") {
    return (
      <ChatErrorShell
        errorKey={errorKey ?? "status.errorUnknown"}
        theme={theme}
        hideHeader={hideHeader}
      />
    )
  }

  return (
    <EmbedChat
      agentName={remoteConfig?.title ?? remoteConfig?.agentName}
      bannerText={remoteConfig?.bannerText ?? undefined}
      isPreviousSessionExpired={isPreviousSessionExpired}
      theme={theme}
      locale={locale}
      displayMode={displayMode}
      hideHeader={hideHeader}
      messages={messages}
      mcpAppHtml={mcpAppHtml}
      isMcpAppHtmlLoading={isMcpAppHtmlLoading}
      isStreaming={isStreaming}
      onSendMessage={send}
      onClose={onClose}
      onNewConversation={reset}
    />
  )
}

// ─── Simulation mode (no embedToken — Storybook / local dev) ──────────────

function SimulatedChat({
  locale,
  displayMode,
  hideHeader,
  onClose,
}: {
  locale: SupportedLocale
  displayMode: EmbedDisplayMode
  hideHeader: boolean
  onClose: () => void
}) {
  // `?demo=greeting` opens on the agent's greeting alone, so the launcher shows its preview card.
  const [messages, setMessages] = useState<AgentSessionMessageDto[]>(() =>
    readParam("demo") === "greeting"
      ? shortConversation.filter((message) => message.role === "assistant")
      : shortConversation,
  )
  const [isStreaming, setIsStreaming] = useState(false)

  useLauncherPreview(true, messages, "Helpful Assistant")

  const handleNewConversation = () => {
    setIsStreaming(false)
    setMessages([])
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isResetSessionMessage(event.data)) return
      setIsStreaming(false)
      setMessages([])
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  const handleSendMessage = (content: string) => {
    const userMessage: AgentSessionMessageDto = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      status: "completed",
    }
    const streamingMessage: AgentSessionMessageDto = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      status: "streaming",
    }

    setMessages((prev) => [...prev, userMessage, streamingMessage])
    setIsStreaming(true)

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((message) =>
          message.status === "streaming"
            ? {
                ...message,
                content: "Thanks for your message! This is a preview response from the embed app.",
                status: "completed",
              }
            : message,
        ),
      )
      setIsStreaming(false)
    }, 1200)
  }

  return (
    <EmbedChat
      agentName="Helpful Assistant"
      bannerText={readParam("bannerText")}
      locale={locale}
      displayMode={displayMode}
      hideHeader={hideHeader}
      messages={messages}
      isStreaming={isStreaming}
      onSendMessage={handleSendMessage}
      onClose={onClose}
      onNewConversation={handleNewConversation}
    />
  )
}

/**
 * Tells the launcher what to show next to its button while the chat is closed: the agent's
 * opening message, as long as the visitor has not written anything.
 * The greeting is public text, which is why any parent origin may read it.
 */
function useLauncherPreview(
  isReady: boolean,
  messages: AgentSessionMessageDto[],
  title: string | null,
) {
  const preview = previewOf(messages)
  useEffect(() => {
    if (!isReady) return
    window.parent.postMessage({ type: "agent-studio:preview", text: preview, title }, "*")
  }, [isReady, preview, title])
}

// ─── Loading / error shells ────────────────────────────────────────────────

function ChatLoadingShell({ theme, hideHeader }: { theme: EmbedChatTheme; hideHeader: boolean }) {
  const { t } = useTranslation("chat")
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-white pointer-coarse:rounded-none">
      {!hideHeader && (
        <div
          className="chat-header flex h-16 shrink-0 items-center gap-3 px-5"
          style={{ backgroundColor: theme.primaryColor ?? DEFAULT_PRIMARY_COLOR }}
        >
          <div className="h-9 w-9 animate-pulse rounded-full bg-white/30" />
          <div className="h-4 w-32 animate-pulse rounded bg-white/30" />
        </div>
      )}
      <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
        {t("status.connecting")}
      </div>
    </div>
  )
}

function ChatErrorShell({
  errorKey,
  theme,
  hideHeader,
}: {
  errorKey: PublicChatErrorKey
  theme: EmbedChatTheme
  hideHeader: boolean
}) {
  const { t } = useTranslation("chat")
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-white pointer-coarse:rounded-none">
      {!hideHeader && (
        <div
          className="chat-header flex h-16 shrink-0 items-center gap-3 px-5"
          style={{ backgroundColor: theme.primaryColor ?? DEFAULT_PRIMARY_COLOR }}
        />
      )}
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-medium text-gray-700">{t(errorKey)}</p>
      </div>
    </div>
  )
}
