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
import { Editor } from "@pierre/diffs/edit"
import { type EditorFactory, EditProvider, FileDiff } from "@pierre/diffs/react"
import { useEffect, useMemo, useState } from "react"

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

const createEditor: EditorFactory<undefined, undefined> = (editorType, options, editStateKey) =>
  new Editor(editorType, options, editStateKey)

const DIFF_OPTIONS = { diffStyle: "unified", disableFileHeader: true, overflow: "wrap" } as const

/**
 * Unified diff of two texts, rendered with @pierre/diffs. `name` is a file name: its extension
 * picks the syntax highlighting.
 *
 * With `onChange`, the new text is edited in the diff itself and the diff follows each change.
 * The old text stays read-only.
 */
export function TextDiff({
  name,
  before,
  after,
  onChange,
}: {
  name: string
  before: string
  after: string
  onChange?: (after: string) => void
}) {
  const ready = useHighlighterReady(getFiletypeFromFileName(name))
  // The editor owns the new text while it is edited: giving its changes back to the diff would
  // restart the edit. So an editable diff starts from the text it was opened with.
  const [initialAfter] = useState(after)
  const shownAfter = onChange ? initialAfter : after

  const fileDiff = useMemo(
    () =>
      parseDiffFromFile(
        { name, contents: toDiffContents(before) },
        { name, contents: toDiffContents(shownAfter) },
      ),
    [name, before, shownAfter],
  )

  if (!ready) return <Skeleton className="h-16 w-full rounded-md" />

  if (!onChange) {
    return (
      <div className="overflow-hidden rounded-md border">
        <FileDiff fileDiff={fileDiff} options={DIFF_OPTIONS} />
      </div>
    )
  }

  // The diff got a final newline when the text had none: take it back out of what is saved.
  const hadFinalNewline = initialAfter === "" || initialAfter.endsWith("\n")
  return (
    <div className="overflow-hidden rounded-md border">
      <EditProvider createEditor={createEditor}>
        <FileDiff
          fileDiff={fileDiff}
          options={DIFF_OPTIONS}
          edit
          onEditChange={(event) => {
            const contents = event.file.contents
            onChange(!hadFinalNewline && contents.endsWith("\n") ? contents.slice(0, -1) : contents)
          }}
        />
      </EditProvider>
    </div>
  )
}
