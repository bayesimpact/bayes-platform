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
  toolCalls?: PublicSessionMessageDto["toolCalls"]
}): PublicSessionMessageDto {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    status: msg.status as PublicSessionMessageDto["status"],
    createdAt: msg.createdAt ?? Date.now(),
    toolCalls: msg.toolCalls,
  }
}

/**
 * How often a reply found still streaming on load is re-fetched. A reload mid-reply drops the
 * SSE stream but the server keeps writing and settles the message on its own (completed, error,
 * or aborted once found orphaned), so the widget only has to notice.
 */
const STREAMING_RECOVERY_POLL_INTERVAL_MS = 2_000

/**
 * Polls that may fail in a row before the reply is given up on. A single failed read (network
 * blip) says nothing about the reply, which the server is still writing.
 */
const STREAMING_RECOVERY_MAX_CONSECUTIVE_FAILURES = 3

/**
 * Longest a reply is followed before it is shown as interrupted. The server settles an orphaned
 * reply within its own window, so this only guards against that never happening.
 */
const STREAMING_RECOVERY_MAX_WAIT_MS = 30 * 60 * 1000

/** Nobody is looking: skip the poll and catch up on the next visible tick. */
const isTabHidden = () => typeof document !== "undefined" && document.hidden

const hasStreamingReply = (messages: { role: string; status?: string }[]) =>
  messages.some((message) => message.role === "assistant" && message.status === "streaming")

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

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
  reset: () => void
}

export function usePublicChat(embedToken: string): UsePublicChatResult {
  const [status, setStatus] = useState<PublicChatStatus>("initializing")
  const [messages, setMessages] = useState<AgentSessionMessageDto[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [errorKey, setErrorKey] = useState<PublicChatErrorKey | null>(null)

  // Keep session in a ref so stream callbacks always see the latest value
  // without re-triggering effects.
  const sessionRef = useRef<StoredSession | null>(null)
  const resetNonceRef = useRef(0)

  const startFreshSession = useCallback(
    async (nonce: number) => {
      clearSession(embedToken)
      sessionRef.current = null
      setMessages([])
      setErrorKey(null)
      setIsStreaming(false)
      setStatus("initializing")

      const newSession = await createSession(embedToken)
      if (resetNonceRef.current !== nonce) return
      sessionRef.current = newSession
      saveSession(embedToken, newSession)
      const sessionData = await getSession(
        embedToken,
        newSession.sessionId,
        newSession.sessionToken,
      )
      if (resetNonceRef.current !== nonce) return
      setMessages(sessionData.messages.map(toDisplayMessage))
      setStatus("ready")
    },
    [embedToken],
  )

  const failInit = useCallback((err: unknown, nonce: number) => {
    if (resetNonceRef.current !== nonce) return
    const key: PublicChatErrorKey =
      err instanceof ApiError && err.isUnauthorized
        ? "status.errorAccessDisabled"
        : "status.errorSessionFailed"
    setErrorKey(key)
    setStatus("error")
  }, [])

  // ── Session init ──────────────────────────────────────────────────────────
  useEffect(() => {
    const nonce = resetNonceRef.current
    let cancelled = false

    async function init() {
      const stillCurrent = () => !cancelled && resetNonceRef.current === nonce
      const stored = loadStoredSession(embedToken)

      if (stored) {
        try {
          const sessionData = await getSession(embedToken, stored.sessionId, stored.sessionToken)
          if (!stillCurrent()) return
          sessionRef.current = stored
          setMessages(sessionData.messages.map(toDisplayMessage))
          setStatus("ready")
          if (hasStreamingReply(sessionData.messages)) {
            void settleStreamingReply(stored, stillCurrent, nonce)
          }
          return
        } catch (err) {
          if (!stillCurrent()) return
          // 401/403 → session expired or invalid, create a new one below
          if (!(err instanceof ApiError && err.isUnauthorized)) {
            setErrorKey("status.errorUnknown")
            setStatus("error")
            return
          }
          clearSession(embedToken)
        }
      }

      try {
        await startFreshSession(nonce)
      } catch (err) {
        failInit(err, nonce)
      }
    }

    /**
     * Re-fetches the session until its streaming reply settles, keeping the composer locked as
     * it was before the reload. Ends when the reply settles, the session is reset, or the
     * widget unmounts. A session that is no longer accepted is replaced by a fresh one, as on
     * load; other failures are tolerated a few times before the reply is shown as interrupted.
     */
    async function settleStreamingReply(
      session: StoredSession,
      stillCurrent: () => boolean,
      nonce: number,
    ) {
      setIsStreaming(true)
      const giveUpAt = Date.now() + STREAMING_RECOVERY_MAX_WAIT_MS
      let consecutiveFailures = 0
      // The reply can no longer be followed: show it interrupted rather than spinning for good.
      const giveUp = () =>
        setMessages((prev) =>
          prev.map((message) =>
            message.status === "streaming" ? { ...message, status: "aborted" } : message,
          ),
        )
      try {
        while (true) {
          await sleep(STREAMING_RECOVERY_POLL_INTERVAL_MS)
          if (!stillCurrent()) return
          if (isTabHidden()) continue

          try {
            const sessionData = await getSession(
              embedToken,
              session.sessionId,
              session.sessionToken,
            )
            if (!stillCurrent()) return
            consecutiveFailures = 0
            // A snapshot of a reply still being written carries nothing new; only the settled
            // thread replaces what the widget shows.
            if (!hasStreamingReply(sessionData.messages)) {
              setMessages(sessionData.messages.map(toDisplayMessage))
              return
            }
          } catch (err) {
            if (!stillCurrent()) return
            if (err instanceof ApiError && err.isUnauthorized) {
              await startFreshSession(nonce).catch((error) => failInit(error, nonce))
              return
            }
            consecutiveFailures += 1
            if (consecutiveFailures >= STREAMING_RECOVERY_MAX_CONSECUTIVE_FAILURES) return giveUp()
            continue
          }

          // Decided on a fresh answer only: a tab left hidden past the deadline must not declare
          // interrupted a reply the server has since completed.
          if (Date.now() > giveUpAt) return giveUp()
        }
      } finally {
        if (stillCurrent()) setIsStreaming(false)
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [embedToken, failInit, startFreshSession])

  const reset = useCallback(() => {
    const nonce = ++resetNonceRef.current
    void startFreshSession(nonce).catch((err) => failInit(err, nonce))
  }, [failInit, startFreshSession])

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
        const nonce = resetNonceRef.current
        try {
          let realMessageId = tempAssistantId
          let shouldHydrate = false

          for await (const event of streamMessages(
            embedToken,
            session.sessionId,
            session.sessionToken,
            content,
          )) {
            if (resetNonceRef.current !== nonce) return
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
                shouldHydrate = true
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

          // Hydrate MCP App HTML only after the SSE generator's `finally` has
          // closed the stream's MCP session. Fetching on `end` raced that close
          // and `resources/read` often failed, so the card appeared only on reload.
          if (shouldHydrate) {
            if (resetNonceRef.current !== nonce) return
            try {
              const sessionData = await getSession(
                embedToken,
                session.sessionId,
                session.sessionToken,
              )
              if (resetNonceRef.current !== nonce) return
              setMessages(sessionData.messages.map(toDisplayMessage))
            } catch {
              // Keep streamed text if the hydrate fetch fails
            }
          }
        } catch {
          if (resetNonceRef.current !== nonce) return
          setMessages((prev) =>
            prev.map((message) =>
              message.id === tempAssistantId || message.status === "streaming"
                ? { ...message, status: "error" }
                : message,
            ),
          )
        } finally {
          if (resetNonceRef.current === nonce) {
            setIsStreaming(false)
          }
        }
      })()
    },
    [embedToken, isStreaming],
  )

  return { status, messages, isStreaming, errorKey, send, reset }
}
