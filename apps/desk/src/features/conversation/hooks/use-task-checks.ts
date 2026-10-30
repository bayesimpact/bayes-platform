import { useState } from "react"
import { taskListOf } from "@/lib/task-list"
import type { ChatMessage } from "../chat-messages"
import { savedTaskStatesOf, type TaskCheck } from "../task-checks"

/**
 * The tasks of the replies the person ticked or unticked: the states their messages saved, and
 * the ticks waiting for the next message, which leave with it. A tick that brings a task back to
 * its saved state waits for nothing.
 */
export function useTaskChecks(messages: ChatMessage[]) {
  const [pending, setPending] = useState<TaskCheck[]>([])
  const saved = savedTaskStatesOf(messages)
  // A task the messages never ticked is as its reply says.
  const savedStateOf = (replyId: string, item: number) =>
    saved.get(replyId)?.get(item) ??
    taskListOf(messages.find((message) => message.id === replyId)?.content ?? "")[item - 1] ??
    false

  return {
    /** The ticks waiting for the next message, in their order. */
    pending,
    clear: () => setPending([]),
    /** The states of a reply's tasks the person changed, saved or waiting, by their place. */
    statesOf: (replyId: string) => {
      const states = new Map(saved.get(replyId))
      for (const check of pending) {
        if (check.replyId === replyId) states.set(check.item, check.isChecked)
      }
      return states
    },
    toggle: (check: TaskCheck) =>
      setPending((current) => {
        const others = current.filter(
          (waiting) => waiting.replyId !== check.replyId || waiting.item !== check.item,
        )
        return check.isChecked === savedStateOf(check.replyId, check.item)
          ? others
          : [...others, check]
      }),
  }
}

export type TaskChecks = ReturnType<typeof useTaskChecks>
