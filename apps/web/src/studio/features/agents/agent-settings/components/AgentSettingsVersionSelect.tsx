import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { cn } from "@caseai-connect/ui/utils"
import { TriangleAlertIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { selectStreaming } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.selectors"
import { findPublishedVersion } from "@/common/features/agents/agent-settings/agent-settings.functions"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import { selectAgentSettingsHistoryDataByAgentId } from "@/common/features/agents/agent-settings/agent-settings.selectors"
import { agentSettingsActions } from "@/common/features/agents/agent-settings/agent-settings.slice"
import { useAbility } from "@/common/hooks/use-ability"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { buildDate } from "@/common/utils/build-date"

/**
 * Which settings version the playground runs new messages with.
 *
 * The draft is called out twice over — the trigger reads "v7 — Draft" and turns amber — because a
 * bare version number is not enough to stop someone demoing an unpublished agent to a client by
 * accident (issue #622).
 *
 * Items carry the version name under the label, as the version history does, so versions are
 * recognisable by what they changed and not only by their number.
 *
 * `versions` is the history list, newest first and already free of archived revisions: the history
 * endpoint omits them, so an archived version is never offered here.
 */
export function AgentSettingsVersionSelect({
  revision,
  agentId,
}: {
  agentId: string
  revision: number | undefined
}) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const { abilities } = useAbility()
  const canManageAgent = abilities.canManageAgent({ agentId })

  const versions = useValue(
    selectAgentSettingsHistoryDataByAgentId({ agentId, includeDraft: true }),
  )

  const isStreaming = useAppSelector(selectStreaming)
  const disabled = isStreaming || versions.length < 2

  if (!canManageAgent || versions.length < 2) {
    return null
  }

  const handleRevisionChange = (revision: number) => {
    dispatch(agentSettingsActions.setPlaygroundRevision({ agentId, revision }))
  }

  const publishedRevision = findPublishedVersion(versions)?.revision
  const selectedVersion = versions.find((version) => version.revision === revision)

  const buildVersionDetail = (version: AgentSettings) => {
    if (version.isDraft) return t("status:draft")
    if (version.revision === publishedRevision)
      return t("agentSettings:version.current", { date: buildDate(version.updatedAt) })
    return buildDate(version.updatedAt)
  }

  /** Compact form, the only one the trigger has room for. */
  const buildVersionLabel = (version: AgentSettings) =>
    t("agentSettings:version.item", {
      revision: version.revision,
      detail: buildVersionDetail(version),
    })

  return (
    <Select
      // A revision missing from the list (none chosen yet, or one the caller did not check) maps
      // to "", so Radix shows the placeholder. Passing it through would leave the trigger blank:
      // the value is set, so no placeholder, and there is no version to label (issue #640).
      value={selectedVersion ? String(selectedVersion.revision) : ""}
      onValueChange={(value) => {
        const parsed = Number.parseInt(value, 10)
        if (!Number.isNaN(parsed)) handleRevisionChange(parsed)
      }}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        aria-label={t("agentSettings:version.ariaLabel")}
        className={cn(
          "font-normal",
          selectedVersion?.isDraft && "border-orange-500 text-orange-500",
        )}
      >
        {/*
         * Radix renders the selected item's own markup here unless it is given children. The
         * items carry the version name over two lines; the trigger keeps the compact label so a
         * long name cannot stretch the header.
         */}
        <SelectValue placeholder={t("agentSettings:version.placeholder")}>
          {selectedVersion?.isDraft && <TriangleAlertIcon className="text-orange-500 size-4" />}{" "}
          {selectedVersion && buildVersionLabel(selectedVersion)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {versions.map((version) => (
          <SelectItem key={version.revision} value={String(version.revision)}>
            <span className="flex flex-col items-start">
              <span>{buildVersionLabel(version)}</span>
              {version.name?.trim() && (
                <span className="text-muted-foreground text-xs">{version.name}</span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
