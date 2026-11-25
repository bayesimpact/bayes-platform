import type { AgentVersionOutputDto } from "@bayes-platform/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { cn } from "cn"
import type { ReactNode } from "react"
import { TimeAgo } from "@/components/shared/TimeAgo"
import { AgentVersionTitle } from "./AgentVersionTitle"

export type AgentVersionListProps = {
  versions: AgentVersionOutputDto[]
  /** The version the right pane shows. */
  shownId: string
  /** The version chosen, which the list marks. */
  selectedId: string
  /** What marks it. */
  selectedNote: ReactNode
  onShow: (versionId: string) => void
}

/** The left pane of the versions: the saved versions of the agent, newest first. */
export function AgentVersionList({
  versions,
  shownId,
  selectedId,
  selectedNote,
  onShow,
}: AgentVersionListProps) {
  return (
    <ul className="flex max-h-56 shrink-0 flex-col overflow-y-auto border-b md:max-h-none md:w-72 md:border-r md:border-b-0">
      {versions.map((version) => {
        const isShown = version.id === shownId
        return (
          <li key={version.id} className="border-b">
            <button
              type="button"
              aria-current={isShown ? "true" : undefined}
              onClick={() => onShow(version.id)}
              className={cn(
                "flex w-full flex-col gap-1 px-4 py-3 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted",
                isShown && "bg-muted",
              )}
            >
              <AgentVersionTitle version={version} />
              <span className="text-xs text-muted-foreground">
                <Trans comment="When a version of an agent was saved, such as: Saved 5 days ago">
                  Saved <TimeAgo moment={version.updatedAt} />
                </Trans>
              </span>
              {version.id === selectedId ? (
                <span className="text-xs font-medium text-primary">{selectedNote}</span>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
