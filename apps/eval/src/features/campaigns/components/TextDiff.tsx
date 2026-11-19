import { MultiFileDiff } from "@pierre/diffs/react"

/** A text as a file the diff reads: a last line with no line break gets one, which means nothing here. */
const contentsOf = (text: string) => (text === "" || text.endsWith("\n") ? text : `${text}\n`)

const DIFF_OPTIONS = { diffStyle: "unified", disableFileHeader: true, overflow: "wrap" } as const

export type TextDiffProps = {
  /** A file name, whose extension picks the highlighting: `.md`, `.json`, `.txt`. */
  name: string
  before: string
  after: string
}

/** The lines one text changes in another, one below the other, with `@pierre/diffs`. */
export function TextDiff({ name, before, after }: TextDiffProps) {
  return (
    <div className="overflow-hidden rounded-md border">
      <MultiFileDiff
        oldFile={{ name, contents: contentsOf(before) }}
        newFile={{ name, contents: contentsOf(after) }}
        options={DIFF_OPTIONS}
      />
    </div>
  )
}
