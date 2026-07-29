import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@caseai-connect/ui/shad/empty"
import { ToggleGroup, ToggleGroupItem } from "@caseai-connect/ui/shad/toggle-group"
import { useTranslation } from "react-i18next"
import { listChangedAgentSettingsFields } from "@/common/features/agents/settings/agent-settings.functions"
import type { AgentSettings } from "@/common/features/agents/settings/agent-settings.models"
import { AgentSettingsFieldDiff } from "./AgentSettingsFieldDiff"
import { AgentVersionPublishButton } from "./AgentVersionPublishButton"
import { AgentVersionRestoreButton } from "./AgentVersionRestoreButton"

export type AgentVersionCompareMode = "previous" | "current"

/**
 * Right pane of the version history: pick what the selected revision is compared against
 * ("what this version changed" vs "how it differs from the current version"), review the
 * per-field diffs, and restore the selected revision.
 */
export function AgentVersionCompare({
  before,
  after,
  selected,
  isCurrent,
  mode,
  onModeChange,
  canComparePrevious,
  canCompareCurrent,
}: {
  before: AgentSettings
  after: AgentSettings
  selected: AgentSettings
  isCurrent: boolean
  mode: AgentVersionCompareMode
  onModeChange: (mode: AgentVersionCompareMode) => void
  canComparePrevious: boolean
  canCompareCurrent: boolean
}) {
  const { t } = useTranslation()
  const changedFields = listChangedAgentSettingsFields(before, after)
  const canCompare = canComparePrevious || canCompareCurrent

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={mode}
          onValueChange={(next) => next && onModeChange(next as AgentVersionCompareMode)}
        >
          <ToggleGroupItem value="previous" disabled={!canComparePrevious}>
            {t("agent:history.compareWithPrevious")}
          </ToggleGroupItem>
          <ToggleGroupItem value="current" disabled={!canCompareCurrent}>
            {t("agent:history.compareWithCurrent")}
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="flex items-center gap-2">
          {selected.isDraft && (
            <AgentVersionPublishButton
              agentId={selected.agentId}
              revision={selected.revision}
              revisionName={selected.revisionName}
              revisionDesc={selected.revisionDesc}
            />
          )}
          <AgentVersionRestoreButton
            agentId={selected.agentId}
            revision={selected.revision}
            disabled={isCurrent}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        {!canCompare ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t("agent:history.onlyVersionTitle")}</EmptyTitle>
              <EmptyDescription>{t("agent:history.onlyVersionDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("agent:history.comparing", {
                before: before.revision,
                after: after.revision,
              })}
            </p>
            {changedFields.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{t("agent:history.noChangesTitle")}</EmptyTitle>
                  <EmptyDescription>{t("agent:history.noChangesDescription")}</EmptyDescription>
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
          </>
        )}
      </div>
    </div>
  )
}
