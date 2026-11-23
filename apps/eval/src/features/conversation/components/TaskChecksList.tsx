import { useLingui } from "@lingui/react/macro"
import { SquareCheckIcon, SquareIcon } from "lucide-react"
import type { TaskCheck } from "../task-checks"

export type TaskChecksListProps = {
  checks: TaskCheck[]
}

/**
 * The tasks a person's message ticked or unticked, under its text: the lines that carry them
 * are hidden, and a message may hold nothing else.
 */
export function TaskChecksList({ checks }: TaskChecksListProps) {
  const { t } = useLingui()
  return (
    <ul className="flex flex-col gap-1 text-message">
      {checks.map(({ replyId, item, isChecked, text }) => (
        <li
          key={`${replyId}:${item}`}
          aria-label={isChecked ? t`Ticked: ${text}` : t`Unticked: ${text}`}
          className="flex items-start gap-2"
        >
          {isChecked ? (
            <SquareCheckIcon aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
          ) : (
            <SquareIcon aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground" />
          )}
          <span>{text}</span>
        </li>
      ))}
    </ul>
  )
}
