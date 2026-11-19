import type { AgentVersionOutputDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "cn"
import { CheckIcon } from "lucide-react"
import { badgeVariants } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  AGENT_VERSION_DIFF_FILE_NAMES,
  AGENT_VERSION_DIFF_LABELS,
  type AgentVersionDiffKey,
  agentVersionFieldText,
} from "../agent-version-diff"
import { useVersionComparison } from "../hooks/use-version-comparison"
import { AgentVersionTitle } from "./AgentVersionTitle"
import { TextDiff } from "./TextDiff"

/** The DOM id of a field's diff, which the line of changed fields scrolls to. */
const diffIdOf = (key: AgentVersionDiffKey) => `agent-version-diff-${key}`

export type AgentVersionCompareProps = {
  version: AgentVersionOutputDto
  /** The saved version before it, none for the first one. */
  previous: AgentVersionOutputDto | undefined
  production: AgentVersionOutputDto | undefined
  /** Whether this version is the one chosen already. */
  isSelected: boolean
  /** Picks this version; `null` shows no button, as when the versions are only read. */
  onSelect: (() => void) | null
}

/**
 * The right pane of the versions: the version shown, the button that picks it for the campaign,
 * then what changed against the version before it or against the one in production.
 */
export function AgentVersionCompare({
  version,
  previous,
  production,
  isSelected,
  onSelect,
}: AgentVersionCompareProps) {
  const { i18n, t } = useLingui()
  const {
    mode,
    setMode,
    canCompareWithPrevious,
    canCompareWithProduction,
    older,
    newer,
    changedFields,
  } = useVersionComparison(version, previous, production)
  const olderRevision = older?.revision
  const newerRevision = newer.revision

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
        <h3 className="text-base font-semibold">
          <AgentVersionTitle version={version} />
        </h3>
        {onSelect ? (
          <Button onClick={onSelect} disabled={isSelected}>
            {isSelected ? (
              <>
                <CheckIcon data-icon="inline-start" />
                <Trans comment="The version a review campaign runs on already">Selected</Trans>
              </>
            ) : (
              <Trans>Select this version</Trans>
            )}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 md:px-6">
        <ToggleGroup
          aria-label={t({
            message: "Compare with",
            comment: "The label of the choice of what a version is compared with",
          })}
          variant="outline"
          size="sm"
          spacing={0}
          value={[mode]}
          // A toggle group lets every item go: the comparison stays when the person clicks it again.
          onValueChange={(values) => {
            const [next] = values
            if (next === "previous" || next === "production") setMode(next)
          }}
        >
          <ToggleGroupItem value="previous" disabled={!canCompareWithPrevious}>
            <Trans>Changes in this version</Trans>
          </ToggleGroupItem>
          <ToggleGroupItem value="production" disabled={!canCompareWithProduction}>
            <Trans>Compare with production</Trans>
          </ToggleGroupItem>
        </ToggleGroup>
        {older ? (
          <p className="text-sm text-muted-foreground">
            <Trans>
              Showing changes from version {olderRevision} to version {newerRevision}.
            </Trans>
          </p>
        ) : null}
      </div>
      {older && changedFields.length > 0 ? (
        // A long diff hides the ones below it: this line names every changed field and leads to it.
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 md:px-6">
          <span className="text-sm text-muted-foreground">
            <Trans>Changed fields:</Trans>
          </span>
          {changedFields.map((key) => (
            <a
              key={key}
              href={`#${diffIdOf(key)}`}
              className={cn(badgeVariants({ variant: "secondary" }), "hover:bg-secondary/80")}
            >
              {i18n._(AGENT_VERSION_DIFF_LABELS[key])}
            </a>
          ))}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 md:p-6">
        {!older ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                <Trans>Only one version</Trans>
              </EmptyTitle>
              <EmptyDescription>
                <Trans>This agent has a single saved version: there is nothing to compare.</Trans>
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : changedFields.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                <Trans>No differences</Trans>
              </EmptyTitle>
              <EmptyDescription>
                <Trans>These two versions have the same settings.</Trans>
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          changedFields.map((key) => (
            <section key={key} id={diffIdOf(key)} className="flex scroll-mt-4 flex-col gap-2">
              <h4 className="font-semibold">{i18n._(AGENT_VERSION_DIFF_LABELS[key])}</h4>
              <TextDiff
                name={AGENT_VERSION_DIFF_FILE_NAMES[key]}
                before={agentVersionFieldText(older, key, i18n)}
                after={agentVersionFieldText(newer, key, i18n)}
              />
            </section>
          ))
        )}
      </div>
    </div>
  )
}
