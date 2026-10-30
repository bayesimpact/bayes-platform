import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "cn"
import { ChevronDownIcon, WrapTextIcon } from "lucide-react"
import { type ReactNode, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFooter,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useHighlightedCode } from "@/hooks/use-highlighted-code"

/** Beyond this many lines, a collapsible block shows its start, and the rest on demand. */
const COLLAPSED_LINE_COUNT = 24

export type HighlightedCodeBlockProps = {
  code: string
  language: string
  /** What the header names, the language by default. */
  title?: ReactNode
  /** The header's actions, in place of the copy button: a page that also downloads the code. */
  actions?: ReactNode
  /** While the code still streams, it cannot be copied yet. */
  isIncomplete?: boolean
  /** Numbered lines, which a toggle in the header wraps: a document rather than a snippet. */
  canWrap?: boolean
  /** A long code shows its start until the person asks for the rest. */
  isCollapsible?: boolean
}

/**
 * Code highlighted by the shadcn Code Block, with its language and a copy button. A long result
 * can wrap its lines and show its start only.
 */
export function HighlightedCodeBlock({
  code,
  language,
  title,
  actions,
  isIncomplete = false,
  canWrap = false,
  isCollapsible = false,
}: HighlightedCodeBlockProps) {
  const { t } = useLingui()
  const contentId = useId()
  const lines = useHighlightedCode(code, language)
  const [isWrapped, setIsWrapped] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const isCollapsed = isCollapsible && lines.length > COLLAPSED_LINE_COUNT && !isExpanded
  const wrapLabel = t`Wrap long lines`

  return (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>
          {title ??
            (language || (
              <Trans comment="The language of a code block that names none">text</Trans>
            ))}
        </CodeBlockTitle>
        <CodeBlockActions>
          {canWrap ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={wrapLabel}
                    aria-pressed={isWrapped}
                    className="aria-pressed:text-foreground"
                    onClick={() => setIsWrapped(!isWrapped)}
                  />
                }
              >
                <WrapTextIcon aria-hidden className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>{wrapLabel}</TooltipContent>
            </Tooltip>
          ) : null}
          {actions ?? (
            <CodeBlockCopyButton
              value={code}
              disabled={isIncomplete}
              aria-label={t`Copy the code`}
            />
          )}
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent
        id={contentId}
        wrap={isWrapped}
        lineNumbers={canWrap}
        className={cn(isCollapsed && "max-h-96 scroll-fade-y overflow-y-hidden")}
      >
        {lines.map((line, index) => (
          // The lines of a block only grow at the end: their position is their identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above.
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
      {isCollapsible && lines.length > COLLAPSED_LINE_COUNT ? (
        <CodeBlockFooter className="justify-center">
          <Button
            variant="ghost"
            size="xs"
            aria-expanded={isExpanded}
            aria-controls={contentId}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ChevronDownIcon
              data-icon="inline-start"
              aria-hidden
              className="transition-transform in-aria-expanded:rotate-180"
            />
            {isExpanded ? <Trans>Show less</Trans> : <Trans>Show more</Trans>}
          </Button>
        </CodeBlockFooter>
      ) : null}
    </CodeBlock>
  )
}
