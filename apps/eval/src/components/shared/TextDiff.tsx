import {
  DEFAULT_THEMES,
  getFiletypeFromFileName,
  getThemes,
  preloadHighlighter,
} from "@pierre/diffs"
import { MultiFileDiff } from "@pierre/diffs/react"
import { Suspense, use } from "react"
import { Skeleton } from "@/components/ui/skeleton"

/** A text as a file the diff reads: a last line with no line break gets one, which means nothing here. */
const contentsOf = (text: string) => (text === "" || text.endsWith("\n") ? text : `${text}\n`)

// The app is light: the diff does not follow a dark system theme.
const DIFF_OPTIONS = {
  diffStyle: "unified",
  disableFileHeader: true,
  overflow: "wrap",
  themeType: "light",
} as const

/** The loading of the highlighter, once per language, whether it succeeds or not. */
const highlighterLoads = new Map<string, Promise<void>>()

/**
 * The highlighter of a file's language, loaded before the first diff: a diff drawn while it loads
 * stays blank under React's StrictMode.
 */
function highlighterFor(name: string): Promise<void> {
  const language = getFiletypeFromFileName(name)
  const loading = highlighterLoads.get(language)
  if (loading) return loading
  const loaded = preloadHighlighter({
    themes: getThemes(DEFAULT_THEMES),
    langs: [language],
  }).catch(() => undefined)
  highlighterLoads.set(language, loaded)
  return loaded
}

export type TextDiffProps = {
  /** A file name, whose extension picks the highlighting: `.md`, `.json`, `.txt`. */
  name: string
  before: string
  after: string
}

/** The lines one text changes in another, one below the other, with `@pierre/diffs`. */
export function TextDiff(props: TextDiffProps) {
  return (
    <div className="overflow-hidden rounded-md border">
      <Suspense fallback={<Skeleton className="h-16 w-full" />}>
        <HighlightedDiff {...props} />
      </Suspense>
    </div>
  )
}

function HighlightedDiff({ name, before, after }: TextDiffProps) {
  use(highlighterFor(name))
  return (
    <MultiFileDiff
      oldFile={{ name, contents: contentsOf(before) }}
      newFile={{ name, contents: contentsOf(after) }}
      options={DIFF_OPTIONS}
    />
  )
}
