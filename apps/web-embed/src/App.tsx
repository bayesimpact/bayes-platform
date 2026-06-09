import type {
  AgentSessionMessageDto,
  EmbedDisplayMode,
  EmbedPublicConfigDto,
} from "@caseai-connect/api-contracts"
import { useEffect, useMemo, useState } from "react"
import { I18nextProvider, useTranslation } from "react-i18next"
import { getEmbedConfig } from "./api/public-chat-api"
import { shortConversation } from "./chat/chat.factory"
import type { EmbedChatTheme } from "./chat/EmbedChat"
import { EmbedChat } from "./chat/EmbedChat"
import type { PublicChatErrorKey } from "./hooks/usePublicChat"
import { usePublicChat } from "./hooks/usePublicChat"
import { createEmbedI18n, type SupportedLocale } from "./i18n"

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

// ─── Root ──────────────────────────────────────────────────────────────────

export function App() {
  const locale = readLocaleFromUrl()
  const i18n = useMemo(() => createEmbedI18n(locale), [locale])

  const embedToken = readParam("embedToken")
  const displayMode = readDisplayModeFromUrl()

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
            onClose={handleClose}
          />
        ) : (
          <SimulatedChat locale={locale} displayMode={displayMode} onClose={handleClose} />
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
  onClose,
}: {
  embedToken: string
  locale: SupportedLocale
  displayMode: EmbedDisplayMode
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

  const { status, messages, isStreaming, errorKey, send } = usePublicChat(embedToken)

  if (status === "initializing") {
    return <ChatLoadingShell theme={theme} />
  }

  if (status === "error") {
    return <ChatErrorShell errorKey={errorKey ?? "status.errorUnknown"} theme={theme} />
  }

  return (
    <EmbedChat
      agentName={remoteConfig?.title ?? remoteConfig?.agentName}
      theme={theme}
      locale={locale}
      displayMode={displayMode}
      messages={messages}
      isStreaming={isStreaming}
      onSendMessage={send}
      onClose={onClose}
    />
  )
}

// ─── Simulation mode (no embedToken — Storybook / local dev) ──────────────

function SimulatedChat({
  locale,
  displayMode,
  onClose,
}: {
  locale: SupportedLocale
  displayMode: EmbedDisplayMode
  onClose: () => void
}) {
  const [messages, setMessages] = useState<AgentSessionMessageDto[]>(shortConversation)
  const [isStreaming, setIsStreaming] = useState(false)

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
      locale={locale}
      displayMode={displayMode}
      messages={messages}
      isStreaming={isStreaming}
      onSendMessage={handleSendMessage}
      onClose={onClose}
    />
  )
}

// ─── Loading / error shells ────────────────────────────────────────────────

function ChatLoadingShell({ theme }: { theme: EmbedChatTheme }) {
  const { t } = useTranslation("chat")
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-white">
      <div
        className="flex h-16 shrink-0 items-center gap-3 px-5"
        style={{ backgroundColor: theme.primaryColor ?? "#2563eb" }}
      >
        <div className="h-9 w-9 animate-pulse rounded-full bg-white/30" />
        <div className="h-4 w-32 animate-pulse rounded bg-white/30" />
      </div>
      <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
        {t("status.connecting")}
      </div>
    </div>
  )
}

function ChatErrorShell({
  errorKey,
  theme,
}: {
  errorKey: PublicChatErrorKey
  theme: EmbedChatTheme
}) {
  const { t } = useTranslation("chat")
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-white">
      <div
        className="flex h-16 shrink-0 items-center gap-3 px-5"
        style={{ backgroundColor: theme.primaryColor ?? "#2563eb" }}
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-medium text-gray-700">{t(errorKey)}</p>
      </div>
    </div>
  )
}
