import type { AgentVersionOutputDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { type ReactNode, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { AgentVersionCompare } from "./AgentVersionCompare"
import { AgentVersionList } from "./AgentVersionList"

export type AgentVersionsSheetProps = {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  agentName: string
  /** The saved versions of the agent, newest first: never empty. */
  versions: AgentVersionOutputDto[]
  /** The version the history opens on and marks: the one chosen, none while there is none. */
  selectedId: string
  /** What marks that version in the list, such as: The campaign runs on this version. */
  selectedNote: ReactNode
  /** Picks a version; `null` leaves the history to read and compare only. */
  onSelect: ((versionId: string) => void) | null
}

/**
 * The history of the agent's saved versions, as the Studio shows it: each version, what it
 * changed, and how it differs from the one in production. Its owner may let the person pick one,
 * for a campaign or an evaluation, or only show them, as from a run.
 */
export function AgentVersionsSheet({
  isOpen,
  onOpenChange,
  agentName,
  versions,
  selectedId,
  selectedNote,
  onSelect,
}: AgentVersionsSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-6xl"
      >
        <SheetHeader className="border-b pr-12">
          <SheetTitle>
            <Trans>Versions of {agentName}</Trans>
          </SheetTitle>
          <SheetDescription>
            {onSelect ? (
              <Trans>Browse and compare the saved versions of the agent, then choose one.</Trans>
            ) : (
              <Trans>Browse and compare the saved versions of the agent.</Trans>
            )}
          </SheetDescription>
        </SheetHeader>
        {/* Its own component: the version shown starts from the selected one at each opening. */}
        <AgentVersionsBrowser
          versions={versions}
          selectedId={selectedId}
          selectedNote={selectedNote}
          onSelect={onSelect}
        />
      </SheetContent>
    </Sheet>
  )
}

type AgentVersionsBrowserProps = Pick<
  AgentVersionsSheetProps,
  "versions" | "selectedId" | "selectedNote" | "onSelect"
>

function AgentVersionsBrowser({
  versions,
  selectedId,
  selectedNote,
  onSelect,
}: AgentVersionsBrowserProps) {
  const [shownId, setShownId] = useState(
    () => versions.find((version) => version.id === selectedId)?.id ?? versions[0]?.id ?? "",
  )
  const index = versions.findIndex((version) => version.id === shownId)
  const shown = versions[index]
  if (!shown) return null
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <AgentVersionList
        versions={versions}
        shownId={shown.id}
        selectedId={selectedId}
        selectedNote={selectedNote}
        onShow={setShownId}
      />
      <AgentVersionCompare
        // Each version starts on its own changes.
        key={shown.id}
        version={shown}
        previous={versions[index + 1]}
        production={versions.find((version) => version.isProduction)}
        hasOtherVersions={versions.length > 1}
        isSelected={shown.id === selectedId}
        onSelect={onSelect ? () => onSelect(shown.id) : null}
      />
    </div>
  )
}
