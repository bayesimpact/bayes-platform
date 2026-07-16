import { Skeleton } from "@caseai-connect/ui/shad/skeleton"
import {
  areLanguagesAttached,
  areThemesAttached,
  DEFAULT_THEMES,
  getFiletypeFromFileName,
  getThemes,
  isHighlighterLoaded,
  parseDiffFromFile,
  preloadHighlighter,
  type SupportedLanguages,
} from "@pierre/diffs"
import { FileDiff } from "@pierre/diffs/react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { Agent } from "@/common/features/agents/agents.models"
import {
  type AgentSettingsDiffKey,
  agentSettingsDiffFileNames,
  agentSettingsDiffLabelKeys,
  serializeAgentSettingsField,
} from "../agent-history.functions"

/**
 * Settings values are not files: a missing trailing newline is meaningless here, so add one
 * before diffing to keep @pierre/diffs from rendering its "No newline at end of file" row.
 */
function toDiffContents(value: string): string {
  if (value === "" || value.endsWith("\n")) return value
  return `${value}\n`
}

/**
 * Gate the diff on the shared Shiki highlighter being fully loaded for `lang`.
 *
 * @pierre/diffs renders nothing on its first pass when the highlighter is not ready yet and
 * leans on an async re-render to fill in. Under React StrictMode the component is mounted twice
 * on the same node: the first (unready) pass leaves an empty `<pre>` in the shadow DOM, and the
 * second mount hydrates from that empty node without ever rendering — so the diff stays blank
 * until an interaction forces a fresh render. Waiting for the highlighter keeps the first render
 * synchronous and non-empty, which sidesteps the whole race. The highlighter is a module-level
 * singleton, so this only shows a placeholder for the very first diff of the session.
 */
function useHighlighterReady(lang: SupportedLanguages): boolean {
  const [ready, setReady] = useState(
    () => isHighlighterLoaded() && areThemesAttached(DEFAULT_THEMES) && areLanguagesAttached(lang),
  )

  useEffect(() => {
    if (ready) return
    let active = true
    const markReady = () => {
      if (active) setReady(true)
    }
    preloadHighlighter({ themes: getThemes(DEFAULT_THEMES), langs: [lang] }).then(
      markReady,
      markReady,
    )
    return () => {
      active = false
    }
  }, [ready, lang])

  return ready
}

/** Diff of a single versioned settings field between two revisions, rendered with @pierre/diffs. */
export function AgentSettingsFieldDiff({
  fieldKey,
  before,
  after,
}: {
  fieldKey: AgentSettingsDiffKey
  before: Agent
  after: Agent
}) {
  const { t } = useTranslation()

  const name = agentSettingsDiffFileNames[fieldKey]
  const ready = useHighlighterReady(getFiletypeFromFileName(name))

  const fileDiff = useMemo(() => {
    return parseDiffFromFile(
      { name, contents: toDiffContents(serializeAgentSettingsField(before, fieldKey)) },
      { name, contents: toDiffContents(serializeAgentSettingsField(after, fieldKey)) },
    )
  }, [name, fieldKey, before, after])

  return (
    <section className="space-y-2">
      <h4 className="text-sm font-medium">{t(agentSettingsDiffLabelKeys[fieldKey])}</h4>
      <div className="overflow-hidden rounded-md border">
        {ready ? (
          <FileDiff
            fileDiff={fileDiff}
            options={{ diffStyle: "unified", disableFileHeader: true, overflow: "wrap" }}
          />
        ) : (
          <Skeleton className="h-16 w-full" />
        )}
      </div>
    </section>
  )
}
