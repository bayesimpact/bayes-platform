import type { AgentVersionOutputDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "cn"
import { fullDateOf } from "@/lib/format-time"
import { AgentVersionTitle } from "./AgentVersionTitle"

export type AgentVersionListProps = {
  versions: AgentVersionOutputDto[]
  /** The version the right pane shows. */
  shownId: string
  /** The version the campaign runs on, which the list marks. */
  selectedId: string
  onShow: (versionId: string) => void
}

/** The left pane of the versions: the saved versions of the agent, newest first. */
export function AgentVersionList({ versions, shownId, selectedId, onShow }: AgentVersionListProps) {
  const { i18n } = useLingui()
  return (
    <ul className="flex max-h-56 shrink-0 flex-col overflow-y-auto border-b md:max-h-none md:w-72 md:border-r md:border-b-0">
      {versions.map((version) => {
        const savedOn = fullDateOf(version.updatedAt, i18n.locale)
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
              {version.description ? (
                <span className="text-sm text-muted-foreground">{version.description}</span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                <Trans>Saved on {savedOn}</Trans>
              </span>
              {version.id === selectedId ? (
                <span className="text-xs font-medium text-primary">
                  <Trans>The campaign runs on this version</Trans>
                </span>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
