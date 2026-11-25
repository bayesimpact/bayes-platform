import type { AgentVersionOutputDto } from "@bayes-platform/eval-contracts"
import { useLingui } from "@lingui/react/macro"
import { useState } from "react"
import { changedAgentVersionFields } from "@/lib/agent-version-diff"

/** What a version is compared with: the version before it, or the one in production. */
export type CompareMode = "previous" | "production"

/**
 * What a version shows against another one: the version before it at first, or the one in
 * production, older first, and the fields that differ. No version to compare with leaves
 * `older` undefined.
 */
export function useVersionComparison(
  version: AgentVersionOutputDto,
  previous: AgentVersionOutputDto | undefined,
  production: AgentVersionOutputDto | undefined,
) {
  const { i18n } = useLingui()
  const canCompareWithProduction = production !== undefined && production.id !== version.id
  const [mode, setMode] = useState<CompareMode>(previous ? "previous" : "production")
  const before = mode === "previous" || !canCompareWithProduction ? previous : production
  // The older version shows first: the one in production is older or newer than this one.
  const [older, newer] =
    before && before.revision > version.revision ? [version, before] : [before, version]
  const changedFields = older ? changedAgentVersionFields(older, newer, i18n) : []
  return {
    mode,
    setMode,
    canCompareWithPrevious: previous !== undefined,
    canCompareWithProduction,
    older,
    newer,
    changedFields,
  }
}
