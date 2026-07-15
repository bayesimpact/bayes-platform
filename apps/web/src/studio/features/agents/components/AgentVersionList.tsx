import { Badge } from "@caseai-connect/ui/shad/badge"
import { cn } from "@caseai-connect/ui/utils"
import { useTranslation } from "react-i18next"
import type { Agent } from "@/common/features/agents/agents.models"
import { buildDate, buildSince } from "@/common/utils/build-date"

/** Timeline of an agent's settings revisions, newest first. */
export function AgentVersionList({
  versions,
  selectedRevision,
  onSelect,
}: {
  versions: Agent[]
  selectedRevision: number
  onSelect: (revision: number) => void
}) {
  const { t } = useTranslation()

  return (
    <aside className="w-52 shrink-0 overflow-y-auto border-r">
      <ol>
        {versions.map((version, index) => (
          <li key={version.revision}>
            <button
              type="button"
              onClick={() => onSelect(version.revision)}
              aria-current={version.revision === selectedRevision}
              className={cn(
                "w-full border-b px-4 py-3 text-left transition-colors hover:bg-muted/50",
                version.revision === selectedRevision && "bg-muted hover:bg-muted",
              )}
            >
              <span className="flex items-center justify-between gap-2 text-sm font-medium">
                {t("agent:history.revisionLabel", { revision: version.revision })}
                {index === 0 && (
                  <Badge variant="secondary">{t("agent:history.currentBadge")}</Badge>
                )}
              </span>
              <span
                className="mt-1 block text-xs text-muted-foreground"
                title={buildDate(version.updatedAt)}
              >
                {buildSince(version.updatedAt)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  )
}
