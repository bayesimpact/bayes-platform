import { useLingui } from "@lingui/react/macro"
import type { ReactNode } from "react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { RELATIVE_TIME_INTERVAL_IN_MILLISECONDS, useNow } from "@/hooks/use-now"
import {
  entryTitleOf,
  groupByPeriod,
  type HistoryAgent,
  type HistoryEntry,
  type HistoryPeriod,
} from "../history-entries"
import { HistoryEntryActions } from "./HistoryEntryActions"
import { HistoryEntryLink } from "./HistoryEntryLink"

export type HistoryListProps = {
  agent: HistoryAgent
  entries: HistoryEntry[]
  /** What the sidebar says before the first session. */
  empty: ReactNode
}

/** The history of an agent in the sidebar, grouped by period, newest first. */
export function HistoryList({ agent, entries, empty }: HistoryListProps) {
  const { t, i18n } = useLingui()
  // The periods move at midnight: a minute late is fine.
  const now = useNow(RELATIVE_TIME_INTERVAL_IN_MILLISECONDS, true)
  const periodLabels: Record<HistoryPeriod, string> = {
    today: t`Today`,
    yesterday: t`Yesterday`,
    previous7Days: t`Previous 7 days`,
    previous30Days: t`Previous 30 days`,
    older: t({ message: "Older", comment: "The history's entries of more than 30 days ago" }),
  }

  if (entries.length === 0) {
    return <p className="px-4 py-2 text-sm text-muted-foreground">{empty}</p>
  }

  return groupByPeriod(entries, now).map((group) => (
    <SidebarGroup key={group.period}>
      <SidebarGroupLabel>{periodLabels[group.period]}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.entries.map((entry) => {
            const title = entryTitleOf(entry, i18n)
            return (
              <SidebarMenuItem key={entry.id}>
                <HistoryEntryLink agent={agent} entry={entry} title={title} />
                <HistoryEntryActions agent={agent} entry={entry} title={title} />
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ))
}
