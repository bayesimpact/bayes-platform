import { useLingui } from "@lingui/react/macro"
import type { ReactNode } from "react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  groupByPeriod,
  type HistoryAgent,
  type HistoryEntry,
  type HistoryPeriod,
} from "../history-entries"
import { ConversationActions } from "./ConversationActions"
import { HistoryEntryLink } from "./HistoryEntryLink"

export type HistoryListProps = {
  agent: HistoryAgent
  entries: HistoryEntry[]
  /** What the sidebar says before the first session. */
  empty: ReactNode
}

/** The history of an agent in the sidebar, grouped by period, newest first. */
export function HistoryList({ agent, entries, empty }: HistoryListProps) {
  const { t } = useLingui()
  const periodLabels: Record<HistoryPeriod, string> = {
    today: t`Today`,
    yesterday: t`Yesterday`,
    previous7Days: t`Previous 7 days`,
    previous30Days: t`Previous 30 days`,
    older: t`Older`,
  }

  if (entries.length === 0) {
    return <p className="px-4 py-2 text-sm text-muted-foreground">{empty}</p>
  }

  return groupByPeriod(entries, Date.now()).map((group) => (
    <SidebarGroup key={group.period}>
      <SidebarGroupLabel>{periodLabels[group.period]}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.entries.map((entry) => (
            <SidebarMenuItem key={entry.id}>
              <HistoryEntryLink agent={agent} entry={entry} />
              {entry.kind === "conversation" ? (
                <ConversationActions
                  agent={agent}
                  agentSessionId={entry.id}
                  title={entry.title ?? t`New conversation`}
                />
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ))
}
