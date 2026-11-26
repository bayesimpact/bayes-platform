import { Badge } from "@bayes-platform/ui/shad/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@bayes-platform/ui/shad/empty"
import { ToggleGroup, ToggleGroupItem } from "@bayes-platform/ui/shad/toggle-group"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import {
  type AgentSettingsDiffKey,
  agentSettingsDiffLabelKeys,
  listChangedAgentSettingsFields,
} from "../../../../../common/features/agents/agent-settings/agent-settings.functions"
import { ProductionDot } from "./AgentRevisionStatusBadge"
import { AgentSettingsCreateButton } from "./AgentSettingsCreateButton"
import {
  type AgentSettingsDeleteBlocker,
  AgentSettingsDeleteButton,
} from "./AgentSettingsDeleteButton"
import { AgentSettingsFieldDiff, agentSettingsFieldDiffId } from "./AgentSettingsFieldDiff"
import { AgentSettingsRestoreButton } from "./AgentSettingsRestoreButton"
import { AgentSettingsSetProductionButton } from "./AgentSettingsSetProductionButton"

/** How long the button of a changed field stays highlighted after a click. */
const JUMP_HIGHLIGHT_MS = 800

/**
 * What the selected revision is diffed against: the revision right before it, the production
 * version the agent runs with, or the pending draft.
 */
export type AgentSettingsCompareMode = "previous" | "current" | "draft"

export type AgentSettingsCompareAvailability = Record<AgentSettingsCompareMode, boolean>

/**
 * Right pane of the version history: pick what the selected revision is compared against,
 * review the per-field diffs, and act on the selected revision: save the draft as a version, put
 * a saved revision in production, restore an older revision, or delete it (discard, for the draft).
 */
export function AgentSettingsCompare({
  before,
  after,
  selected,
  isLatest,
  deleteBlocker,
  hasDraft,
  availability,
  mode,
  onModeChange,
}: {
  before: AgentSettings
  after: AgentSettings
  selected: AgentSettings
  isLatest: boolean
  /** Set when the selected revision cannot be deleted, with the reason shown on the button. */
  deleteBlocker?: AgentSettingsDeleteBlocker
  /** Drives the third toggle: only offered when the agent has a pending draft. */
  hasDraft: boolean
  availability: AgentSettingsCompareAvailability
  mode: AgentSettingsCompareMode
  onModeChange: (mode: AgentSettingsCompareMode) => void
}) {
  const { t } = useTranslation()
  const changedFields = listChangedAgentSettingsFields(before, after)
  const canCompare = availability.previous || availability.current || availability.draft

  // The field the user just jumped to: its button stays highlighted for a moment, as a
  // confirmation of the click while the diff scrolls into view.
  const [jumpedField, setJumpedField] = useState<AgentSettingsDiffKey | null>(null)
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (jumpTimer.current) clearTimeout(jumpTimer.current)
    },
    [],
  )
  const jumpToField = (fieldKey: AgentSettingsDiffKey) => {
    document
      .getElementById(agentSettingsFieldDiffId(fieldKey))
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
    setJumpedField(fieldKey)
    if (jumpTimer.current) clearTimeout(jumpTimer.current)
    jumpTimer.current = setTimeout(() => setJumpedField(null), JUMP_HIGHLIGHT_MS)
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* First what is selected and the actions on it, then what it is compared with: the
          actions no longer share a line with the comparison switch. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            {t("agentSettings:history.revisionLabel", { revision: selected.revision })}
            {selected.isDraft && <Badge variant="warning">{t("status:draft")}</Badge>}
            {selected.isProduction && (
              <Badge variant="success">
                <ProductionDot />
                {t("agentSettings:production.badge")}
              </Badge>
            )}
          </h3>
          {selected.name?.trim() && (
            <p className="truncate text-sm text-muted-foreground">{selected.name}</p>
          )}
        </div>
        {/* The draft is the newest revision: there is nothing to restore it from, and saving it
            as a version is the one thing left to do with it. */}
        {selected.isDraft ? (
          <div className="flex items-center gap-2">
            <AgentSettingsDeleteButton
              revision={selected.revision}
              isDraft
              blocker={deleteBlocker}
            />
            <AgentSettingsCreateButton
              agentSettings={selected}
              buttonProps={{ size: "default", className: undefined }}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <AgentSettingsDeleteButton
              revision={selected.revision}
              isDraft={false}
              blocker={deleteBlocker}
            />
            <AgentSettingsSetProductionButton selected={selected} />
            <AgentSettingsRestoreButton revision={selected.revision} disabled={isLatest} />
          </div>
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

      {/* A long diff hides the ones under it: this line, which never scrolls away, names every
          changed field and jumps to its diff. */}
      {canCompare && changedFields.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b px-6 py-3">
          <span className="text-sm text-muted-foreground">
            {t("agentSettings:history.changedFields", { count: changedFields.length })}
          </span>
          {changedFields.map((fieldKey) => (
            <Badge
              key={fieldKey}
              asChild
              variant={fieldKey === jumpedField ? "default" : "secondary"}
              className="cursor-pointer transition-colors duration-200"
            >
              <button type="button" onClick={() => jumpToField(fieldKey)}>
                {t(agentSettingsDiffLabelKeys[fieldKey])}
              </button>
            </Badge>
          ))}
        </div>
      )}

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
