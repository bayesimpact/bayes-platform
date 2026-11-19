import { CheckCircle2Icon, CircleDashedIcon, CircleSlashIcon } from "lucide-react"
import type { ReactElement } from "react"
import { SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar"

export type SidebarSessionItemProps = {
  /** The link that opens the session, rendered as the entry. */
  link: ReactElement
  /** When the session started, as the entry names it. */
  label: string
  /** Whether the person's part is done: their review given, or their feedback. */
  isDone: boolean
  /** Whether it failed, as a run of an evaluation may: its mark is then a struck circle. */
  hasFailed?: boolean
  /** What the mark of the session's state reads to a screen reader. */
  stateLabel: string
}

/**
 * A session of a campaign in the sidebar, under its campaign, or a run under its dataset: its
 * date and where it stands.
 */
export function SidebarSessionItem({
  link,
  label,
  isDone,
  hasFailed = false,
  stateLabel,
}: SidebarSessionItemProps) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton render={link}>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span role="img" aria-label={stateLabel} className="flex shrink-0">
          {hasFailed ? (
            <CircleSlashIcon aria-hidden className="size-4 text-destructive" />
          ) : isDone ? (
            <CheckCircle2Icon aria-hidden className="size-4 text-primary" />
          ) : (
            <CircleDashedIcon aria-hidden className="size-4 text-muted-foreground" />
          )}
        </span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}
