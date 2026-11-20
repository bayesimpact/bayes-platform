import type { AgentVersionOutputDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useState } from "react"
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
  /** The version the campaign runs on, none while it has none. */
  selectedId: string
  onSelect: (versionId: string) => void
}

/**
 * The history of the agent's saved versions, as the Studio shows it: each version, what it
 * changed, and how it differs from the one in production. The manager picks the one the
 * campaign runs on.
 */
export function AgentVersionsSheet({
  isOpen,
  onOpenChange,
  agentName,
  versions,
  selectedId,
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
            <Trans>
              Browse and compare the saved versions of the agent, then choose the one the campaign
              runs on.
            </Trans>
          </SheetDescription>
        </SheetHeader>
        {/* Its own component: the version shown starts from the selected one at each opening. */}
        <AgentVersionsBrowser versions={versions} selectedId={selectedId} onSelect={onSelect} />
      </SheetContent>
    </Sheet>
  )
}

type AgentVersionsBrowserProps = Pick<
  AgentVersionsSheetProps,
  "versions" | "selectedId" | "onSelect"
>

function AgentVersionsBrowser({ versions, selectedId, onSelect }: AgentVersionsBrowserProps) {
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
        onShow={setShownId}
      />
      <AgentVersionCompare
        // Each version starts on its own changes.
        key={shown.id}
        version={shown}
        previous={versions[index + 1]}
        production={versions.find((version) => version.isProduction)}
        isSelected={shown.id === selectedId}
        onSelect={() => onSelect(shown.id)}
      />
    </div>
  )
}
