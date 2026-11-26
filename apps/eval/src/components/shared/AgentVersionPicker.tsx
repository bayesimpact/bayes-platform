import { Button } from "@caseai-connect/app-ui/components/button"
import {
  FieldDescription,
  FieldError,
  FieldLegend,
  FieldSet,
} from "@caseai-connect/app-ui/components/field"
import type { AgentVersionOutputDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { HistoryIcon } from "lucide-react"
import { type ReactNode, useState } from "react"
import { AgentVersionsSheet } from "./AgentVersionsSheet"
import { AgentVersionTitle } from "./AgentVersionTitle"
import { TimeAgo } from "./TimeAgo"

export type AgentVersionPickerProps = {
  /** The saved versions of the agent, newest first. */
  versions: AgentVersionOutputDto[]
  agentName: string
  /** The id of the version chosen, empty when none is. */
  selectedId: string
  onSelect: (versionId: string) => void
  /** What the version is chosen for, under the field's name. */
  description: ReactNode
  /** What marks the chosen version in the history, such as: The campaign runs on this version. */
  selectedNote: ReactNode
  /** What the field says when no version is chosen and one is needed. */
  error?: ReactNode
  /** Whether the version can no longer change: the history does not open. */
  isLocked?: boolean
}

/**
 * Picks a saved version of an agent in the history of its versions, where two of them compare:
 * the version a review campaign runs on, or the one an evaluation asks. Never the draft.
 */
export function AgentVersionPicker({
  versions,
  agentName,
  selectedId,
  onSelect,
  description,
  selectedNote,
  error,
  isLocked = false,
}: AgentVersionPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selected = versions.find((version) => version.id === selectedId)
  const isInvalid = Boolean(error)
  return (
    <FieldSet data-invalid={isInvalid}>
      <FieldLegend variant="label">
        <Trans comment="The saved version of the agent's settings a review campaign or an evaluation runs on">
          Agent version
        </Trans>
      </FieldLegend>
      <FieldDescription>{description}</FieldDescription>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        {selected ? (
          <div className="flex min-w-0 flex-col gap-0.5">
            <AgentVersionTitle version={selected} />
            <span className="text-sm text-muted-foreground">
              <Trans comment="When a version of an agent was saved, such as: Saved 5 days ago">
                Saved <TimeAgo moment={selected.updatedAt} />
              </Trans>
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            <Trans>No version chosen yet.</Trans>
          </span>
        )}
        <Button type="button" variant="outline" onClick={() => setIsOpen(true)} disabled={isLocked}>
          <HistoryIcon data-icon="inline-start" />
          <Trans>Choose a version</Trans>
        </Button>
        <AgentVersionsSheet
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          agentName={agentName}
          versions={versions}
          selectedId={selectedId}
          selectedNote={selectedNote}
          onSelect={(versionId) => {
            onSelect(versionId)
            setIsOpen(false)
          }}
        />
      </div>
      {isInvalid ? <FieldError>{error}</FieldError> : null}
    </FieldSet>
  )
}
