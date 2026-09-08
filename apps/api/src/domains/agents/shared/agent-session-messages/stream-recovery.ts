import { LessThan } from "typeorm"
import type { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { AgentMessage } from "./agent-message.entity"

/**
 * How long a "streaming" assistant message may go without a write before it is considered
 * orphaned.
 *
 * A stream survives its client: a page refresh closes the SSE connection but the server keeps
 * generating and settles the message on its own. Only a server that died mid-reply leaves the
 * row streaming for good. A live stream keeps writing to the row (tool persists, and a heartbeat
 * every {@link STREAM_HEARTBEAT_MS}), so silence for the whole window is what marks it dead,
 * however long the turn has been running.
 */
export const STREAM_TIMEOUT_MS = 5 * 60 * 1000

/** How often a progressing stream touches its message at most, so it is not taken for orphaned. */
export const STREAM_HEARTBEAT_MS = 60 * 1000

/**
 * Wraps the write that touches a streaming message so it runs at most once per
 * {@link STREAM_HEARTBEAT_MS}, however often progress is reported. The returned function is
 * called on every chunk of the answer. Progress, not the passing of time, is what keeps the row
 * alive: a stream that hangs stops touching it and settles as aborted once the window has
 * passed, instead of staying live for as long as its provider timeout allows.
 */
export function throttleHeartbeat(touch: () => void, now: () => number = Date.now): () => void {
  let lastTouchedAt = now()
  return () => {
    const current = now()
    if (current - lastTouchedAt < STREAM_HEARTBEAT_MS) return
    lastTouchedAt = current
    touch()
  }
}

const toTime = (value: Date | string): number =>
  (value instanceof Date ? value : new Date(value)).getTime()

export function isStreamStale(message: AgentMessage, now: number = Date.now()): boolean {
  if (message.status !== "streaming" || !message.startedAt) return false
  const lastWriteAt = Math.max(toTime(message.startedAt), toTime(message.updatedAt))
  return now - lastWriteAt > STREAM_TIMEOUT_MS
}

/**
 * Marks the message as aborted when its stream is stale, and returns it in its settled state so
 * callers can hand it straight back to the client.
 *
 * The empty content is kept and `completedAt` stays null: nothing was ever written, and the
 * client renders an aborted message as an interrupted reply, not as an answer. The update is
 * conditional on the row still streaming: a stream that completes between the read and the
 * write keeps its outcome, and the message is returned as read (the next poll sees it settled).
 */
export async function recoverAbortedStream({
  agentMessageConnectRepository,
  connectScope,
  message,
}: {
  agentMessageConnectRepository: ConnectRepository<AgentMessage>
  connectScope: RequiredConnectScope
  message: AgentMessage
}): Promise<AgentMessage> {
  if (!isStreamStale(message)) return message
  const affected = await agentMessageConnectRepository.updateManyBy({
    connectScope,
    where: { id: message.id, status: "streaming" },
    fields: { status: "aborted" },
  })
  if (affected === 0) return message
  message.status = "aborted"
  return message
}

/**
 * Settles every stale streaming message of a session in one statement, so the list endpoints
 * that call this on every load pay one write only when something is stale. A row is stale when
 * neither its start nor its last write falls inside the window (see {@link isStreamStale}).
 */
export async function recoverAbortedStreams({
  agentMessageConnectRepository,
  connectScope,
  sessionId,
  now = Date.now(),
}: {
  agentMessageConnectRepository: ConnectRepository<AgentMessage>
  connectScope: RequiredConnectScope
  sessionId: string
  now?: number
}): Promise<void> {
  const threshold = new Date(now - STREAM_TIMEOUT_MS)
  await agentMessageConnectRepository.updateManyBy({
    connectScope,
    where: {
      sessionId,
      role: "assistant",
      status: "streaming",
      startedAt: LessThan(threshold),
      updatedAt: LessThan(threshold),
    },
    fields: { status: "aborted" },
  })
}
