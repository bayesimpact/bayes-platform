import type { AgentSessionMessageDto } from "@caseai-connect/api-contracts"
import { useState } from "react"
import { shortConversation } from "./chat/chat.factory"
import type { EmbedChatTheme } from "./chat/EmbedChat"
import { EmbedChat } from "./chat/EmbedChat"
import type { SupportedLocale } from "./i18n"

/**
 * Development preview page served by the Vite dev server.
 * The iframe in production will eventually load /chat/:embedToken which
 * fetches real config + session from the API. For now this page reads
 * configuration from URL search params so Storybook iframe stories can
 * drive it without any backend.
 *
 * Supported params:
 *   ?primaryColor=%232563eb
 *   ?locale=fr
 *   ?agentName=Support+Assistant
 *   ?logoUrl=https://…
 */
function readThemeFromUrl(): EmbedChatTheme {
  const params = new URLSearchParams(window.location.search)
  return {
    primaryColor: params.get("primaryColor") ?? undefined,
    logoUrl: params.get("logoUrl") ?? undefined,
  }
}

function readLocaleFromUrl(): SupportedLocale {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get("locale")
  return raw === "fr" ? "fr" : "en"
}

function readAgentNameFromUrl(): string | undefined {
  const params = new URLSearchParams(window.location.search)
  return params.get("agentName") ?? undefined
}

export function App() {
  const [messages, setMessages] = useState<AgentSessionMessageDto[]>(shortConversation)
  const [isStreaming, setIsStreaming] = useState(false)

  const theme = readThemeFromUrl()
  const locale = readLocaleFromUrl()
  const agentName = readAgentNameFromUrl()

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
    <div className="h-screen w-full">
      <EmbedChat
        agentName={agentName}
        theme={theme}
        locale={locale}
        messages={messages}
        isStreaming={isStreaming}
        onSendMessage={handleSendMessage}
      />
    </div>
  )
}
