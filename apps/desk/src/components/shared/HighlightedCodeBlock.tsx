import { useLingui } from "@lingui/react/macro"
import type { ReactNode } from "react"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block"
import { useHighlightedCode } from "@/hooks/use-highlighted-code"

export type HighlightedCodeBlockProps = {
  code: string
  language: string
  /** What the header names, the language by default. */
  title?: ReactNode
  /** While the code still streams, it cannot be copied yet. */
  isIncomplete?: boolean
  /** Whether the header copies the code; a page that copies it elsewhere leaves it out. */
  canCopy?: boolean
}

/** Code highlighted by the shadcn Code Block, with its language and a copy button. */
export function HighlightedCodeBlock({
  code,
  language,
  title,
  isIncomplete = false,
  canCopy = true,
}: HighlightedCodeBlockProps) {
  const { t } = useLingui()
  const lines = useHighlightedCode(code, language)
  return (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>{title ?? (language || "text")}</CodeBlockTitle>
        {canCopy ? (
          <CodeBlockActions>
            <CodeBlockCopyButton
              value={code}
              disabled={isIncomplete}
              aria-label={t`Copy the code`}
            />
          </CodeBlockActions>
        ) : null}
      </CodeBlockHeader>
      <CodeBlockContent>
        {lines.map((line, index) => (
          // The lines of a block only grow at the end: their position is their identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above.
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}
