import { Badge } from "@caseai-connect/ui/shad/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@caseai-connect/ui/shad/empty"
import { ToggleGroup, ToggleGroupItem } from "@caseai-connect/ui/shad/toggle-group"
import { useTranslation } from "react-i18next"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import { listChangedAgentSettingsFields } from "../../../../../common/features/agents/agent-settings/agent-settings.functions"
import { AgentSettingsCreateButton } from "./AgentSettingsCreateButton"
import { AgentSettingsFieldDiff } from "./AgentSettingsFieldDiff"
import { AgentSettingsRestoreButton } from "./AgentSettingsRestoreButton"

/**
 * What the selected revision is diffed against: the revision right before it, the published
 * version the agent runs with, or the pending draft.
 */
export type AgentSettingsCompareMode = "previous" | "current" | "draft"

export type AgentSettingsCompareAvailability = Record<AgentSettingsCompareMode, boolean>

/**
 * Right pane of the version history: pick what the selected revision is compared against,
 * review the per-field diffs, and act on the selected revision: save the draft as a version,
 * or restore an older revision.
 */
export function AgentSettingsCompare({
  before,
  after,
  selected,
  isLatest,
  hasDraft,
  availability,
  mode,
  onModeChange,
}: {
  before: AgentSettings
  after: AgentSettings
  selected: AgentSettings
  isLatest: boolean
  /** Drives the third toggle: only offered when the agent has a pending draft. */
  hasDraft: boolean
  availability: AgentSettingsCompareAvailability
  mode: AgentSettingsCompareMode
  onModeChange: (mode: AgentSettingsCompareMode) => void
}) {
  const { t } = useTranslation()
  const changedFields = listChangedAgentSettingsFields(before, after)
  const canCompare = availability.previous || availability.current || availability.draft

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* First what is selected and the one action on it, then what it is compared with: the
          action no longer shares a line with the comparison switch. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            {t("agentSettings:history.revisionLabel", { revision: selected.revision })}
            {selected.isDraft && <Badge variant="warning">{t("status:draft")}</Badge>}
          </h3>
          {selected.name?.trim() && (
            <p className="truncate text-sm text-muted-foreground">{selected.name}</p>
          )}
        </div>
        {/* The draft is the newest revision: there is nothing to restore it from, and saving it
            as a version is the one thing left to do with it. */}
        {selected.isDraft ? (
          <AgentSettingsCreateButton
            agentSettings={selected}
            buttonProps={{ size: "default", className: undefined }}
          />
        ) : (
          <AgentSettingsRestoreButton revision={selected.revision} disabled={isLatest} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b px-6 py-3">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={mode}
          onValueChange={(next) => next && onModeChange(next as AgentSettingsCompareMode)}
        >
          <ToggleGroupItem value="previous" disabled={!availability.previous}>
            {t("agentSettings:history.compareWithPrevious")}
          </ToggleGroupItem>
          <ToggleGroupItem value="current" disabled={!availability.current}>
            {t("agentSettings:history.compareWithCurrent")}
          </ToggleGroupItem>
          {hasDraft && (
            <ToggleGroupItem value="draft" disabled={!availability.draft}>
              {t("agentSettings:history.compareWithDraft")}
            </ToggleGroupItem>
          )}
        </ToggleGroup>
        {canCompare && (
          <p className="text-sm text-muted-foreground">
            {t("agentSettings:history.comparing", {
              before: before.revision,
              after: after.revision,
            })}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
        {!canCompare ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t("agentSettings:history.onlyVersionTitle")}</EmptyTitle>
              <EmptyDescription>
                {t("agentSettings:history.onlyVersionDescription")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : changedFields.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t("agentSettings:history.noChangesTitle")}</EmptyTitle>
              <EmptyDescription>{t("agentSettings:history.noChangesDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          changedFields.map((fieldKey) => (
            <AgentSettingsFieldDiff
              key={fieldKey}
              fieldKey={fieldKey}
              before={before}
              after={after}
            />
          ))
        )}
      </div>
    </div>
  )
}
