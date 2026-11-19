import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { HistoryIcon } from "lucide-react"
import { type ReactNode, useState } from "react"
import { TimeAgo } from "@/components/shared/TimeAgo"
import { Button } from "@/components/ui/button"
import { FieldDescription, FieldError, FieldLegend, FieldSet } from "@/components/ui/field"
import { agentVersionsQueryOptions } from "../api/queries"
import { AgentVersionsSheet } from "./AgentVersionsSheet"
import { AgentVersionTitle } from "./AgentVersionTitle"

export type AgentVersionPickerProps = {
  agentParams: AgentParamsDto
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
}

/**
 * Picks a saved version of an agent in the history of its versions, where two of them compare:
 * the version a review campaign runs on, or the one an evaluation asks. Never the draft.
 */
export function AgentVersionPicker({
  agentParams,
  agentName,
  selectedId,
  onSelect,
  description,
  selectedNote,
  error,
}: AgentVersionPickerProps) {
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(agentParams))
  const [isOpen, setIsOpen] = useState(false)
  const selected = versions.find((version) => version.id === selectedId)
  const isInvalid = Boolean(error)
  return (
    <FieldSet data-invalid={isInvalid}>
      <FieldLegend variant="label">
        <Trans comment="The saved version of the agent's settings a review campaign runs on">
          Agent version
        </Trans>
      </FieldLegend>
      <FieldDescription>{description}</FieldDescription>
      {versions.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <Trans>
            This agent has no saved version yet. Save its settings in the Studio, then come back.
          </Trans>
        </p>
      ) : (
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
          <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
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
      )}
      {isInvalid && versions.length > 0 ? <FieldError>{error}</FieldError> : null}
    </FieldSet>
  )
}
