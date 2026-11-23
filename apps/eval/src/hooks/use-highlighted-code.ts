import { type ReactNode, useEffect, useState } from "react"
import { loadHighlighter } from "@/lib/highlighter"

type Highlighter = NonNullable<Awaited<ReturnType<typeof loadHighlighter>>>
type GrammarState = Parameters<Highlighter["highlight"]>[1]

/** The complete lines of the code highlighted so far, and the grammar state after them. */
type HighlightedLines = {
  highlighter: Highlighter | null
  text: string
  lines: ReactNode[]
  state?: GrammarState
}

/**
 * The lines of some code, highlighted once its language loads and plain until then. While the
 * code streams, only its new lines are tokenized, from the grammar state of the last complete
 * one, and the line still being written on every render.
 */
export function useHighlightedCode(value: string, language: string): ReactNode[] {
  // A trailing newline would render as an extra empty line.
  const code = value.endsWith("\n") ? value.slice(0, -1) : value
  const [loaded, setLoaded] = useState<{
    language: string
    highlighter: Highlighter | null
  } | null>(null)
  const highlighter = loaded?.language === language ? loaded.highlighter : null

  // The highlighter loads outside React, which an effect follows.
  useEffect(() => {
    let isCancelled = false
    loadHighlighter(language)
      .then((next) => {
        if (!isCancelled) setLoaded({ language, highlighter: next })
      })
      .catch((error: unknown) => {
        console.error(`The highlighting of ${language} could not load:`, error)
      })
    return () => {
      isCancelled = true
    }
  }, [language])

  // The lines highlighted on earlier renders, kept in state as React allows during render.
  const [done, setDone] = useState<HighlightedLines>({ highlighter: null, text: "", lines: [] })
  let next = done
  if (next.highlighter !== highlighter || !code.startsWith(next.text)) {
    next = { highlighter, text: "", lines: [] }
  }
  const end = code.lastIndexOf("\n") + 1
  if (highlighter && end > next.text.length) {
    const result = highlighter.highlight(code.slice(next.text.length, end - 1), next.state)
    next = {
      highlighter,
      text: code.slice(0, end),
      lines: [...next.lines, ...result.lines],
      state: result.state,
    }
  }
  if (next !== done) setDone(next)

  if (!highlighter) return code.split("\n")
  // The last line is still being written, so it is tokenized on every render.
  const tail = code.slice(end)
  return [...next.lines, highlighter.highlight(tail, next.state).lines[0]]
}
