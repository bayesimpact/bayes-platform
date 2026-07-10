import type { AgentSessionMessageDto, PublicSessionMessageDto } from "@caseai-connect/api-contracts"
import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError, createSession, getSession, streamMessages } from "../api/public-chat-api"

// ─── Session persistence ───────────────────────────────────────────────────

type StoredSession = { sessionId: string; sessionToken: string }

function storageKey(embedToken: string) {
  return `agentstudio:embed:${embedToken}`
}

function loadStoredSession(embedToken: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(storageKey(embedToken))
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}

function saveSession(embedToken: string, session: StoredSession) {
  try {
    localStorage.setItem(storageKey(embedToken), JSON.stringify(session))
  } catch {
    // localStorage unavailable in some cross-origin iframes — silently ignore
  }
}

function clearSession(embedToken: string) {
  try {
    localStorage.removeItem(storageKey(embedToken))
  } catch {}
}

// ─── Message helpers ───────────────────────────────────────────────────────

function toDisplayMessage(msg: {
  id: string
  role: "user" | "assistant" | "tool"
  content: string
  status?: string
  createdAt?: number
}): PublicSessionMessageDto {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    status: msg.status as PublicSessionMessageDto["status"],
    createdAt: msg.createdAt ?? Date.now(),
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export type PublicChatStatus = "initializing" | "ready" | "error"

/** i18n key under the "chat" namespace */
export type PublicChatErrorKey =
  | "status.errorAccessDisabled"
  | "status.errorSessionFailed"
  | "status.errorUnknown"

export type UsePublicChatResult = {
  status: PublicChatStatus
  messages: AgentSessionMessageDto[]
  isStreaming: boolean
  errorKey: PublicChatErrorKey | null
  send: (content: string) => void
}

export function usePublicChat(embedToken: string): UsePublicChatResult {
  const [status, setStatus] = useState<PublicChatStatus>("initializing")
  const [messages, setMessages] = useState<AgentSessionMessageDto[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [errorKey, setErrorKey] = useState<PublicChatErrorKey | null>(null)

  // Keep session in a ref so stream callbacks always see the latest value
  // without re-triggering effects.
  const sessionRef = useRef<StoredSession | null>(null)

  // ── Session init ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      const stored = loadStoredSession(embedToken)

      if (stored) {
        try {
          const sessionData = await getSession(embedToken, stored.sessionId, stored.sessionToken)
          if (cancelled) return
          sessionRef.current = stored
          setMessages(sessionData.messages.map(toDisplayMessage))
          setStatus("ready")
          return
        } catch (err) {
          if (cancelled) return
          // 401/403 → session expired or invalid, create a new one below
          if (!(err instanceof ApiError && err.isUnauthorized)) {
            setErrorKey("status.errorUnknown")
            setStatus("error")
            return
          }
          clearSession(embedToken)
        }
      }

      // No stored session, or previous one was expired — create fresh
      try {
        const newSession = await createSession(embedToken)
        if (cancelled) return
        sessionRef.current = newSession
        saveSession(embedToken, newSession)
        const sessionData = await getSession(
          embedToken,
          newSession.sessionId,
          newSession.sessionToken,
        )
        if (cancelled) return
        setMessages(sessionData.messages.map(toDisplayMessage))
        setStatus("ready")
      } catch (err) {
        if (cancelled) return
        const key: PublicChatErrorKey =
          err instanceof ApiError && err.isUnauthorized
            ? "status.errorAccessDisabled"
            : "status.errorSessionFailed"
        setErrorKey(key)
        setStatus("error")
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [embedToken])

  // ── Send message ──────────────────────────────────────────────────────────
  const send = useCallback(
    (content: string) => {
      const session = sessionRef.current
      if (!session || isStreaming) return

      const tempUserId = `user-${Date.now()}`
      const tempAssistantId = `assistant-${Date.now()}`

      // Optimistic update: user message + empty streaming placeholder
      setMessages((prev) => [
        ...prev,
        { id: tempUserId, role: "user", content, status: "completed" },
        { id: tempAssistantId, role: "assistant", content: "", status: "streaming" },
      ])
      setIsStreaming(true)

      void (async () => {
        try {
          let realMessageId = tempAssistantId

          for await (const event of streamMessages(
            embedToken,
            session.sessionId,
            session.sessionToken,
            content,
          )) {
            switch (event.type) {
              case "start":
                realMessageId = event.messageId
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === tempAssistantId ? { ...message, id: realMessageId } : message,
                  ),
                )
                break

              case "chunk":
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === realMessageId
                      ? { ...message, content: message.content + event.content }
                      : message,
                  ),
                )
                break

              case "end":
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === realMessageId
                      ? { ...message, content: event.fullContent, status: "completed" }
                      : message,
                  ),
                )
                break

              case "error":
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === realMessageId ? { ...message, status: "error" } : message,
                  ),
                )
                break

              case "notify_client":
                // Tool call in progress — no UI change needed in the embed
                break
            }
          }
        } catch {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === tempAssistantId || message.status === "streaming"
                ? { ...message, status: "error" }
                : message,
            ),
          )
        } finally {
          setIsStreaming(false)
        }
      })()
    },
    [embedToken, isStreaming],
  )

  return { status, messages, isStreaming, errorKey, send }
}
