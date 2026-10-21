import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "cn"
import { ChevronDownIcon, FileJsonIcon, WrapTextIcon } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockFooter,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useHighlightedCode } from "@/hooks/use-highlighted-code"

/** Beyond this many lines, the JSON shows its start, and the rest on demand. */
const COLLAPSED_LINE_COUNT = 24

export type ResultJsonProps = {
  json: string
  fileName: string
}

/**
 * The JSON of a result, as the shadcn Code Block shows code: numbered lines, which can wrap, and
 * a long result shortened until the person asks for the rest.
 */
export function ResultJson({ json, fileName }: ResultJsonProps) {
  const { t } = useLingui()
  const contentId = useId()
  const lines = useHighlightedCode(json, "json")
  const [isWrapped, setIsWrapped] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const isLong = lines.length > COLLAPSED_LINE_COUNT
  const wrapLabel = isWrapped ? t`Scroll long lines` : t`Wrap long lines`

  return (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>
          <FileJsonIcon aria-hidden />
          {fileName}
        </CodeBlockTitle>
        <CodeBlockActions>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t`Wrap long lines`}
                  aria-pressed={isWrapped}
                  className="aria-pressed:text-foreground"
                  onClick={() => setIsWrapped(!isWrapped)}
                />
              }
            >
              <WrapTextIcon aria-hidden />
            </TooltipTrigger>
            <TooltipContent>{wrapLabel}</TooltipContent>
          </Tooltip>
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent
        id={contentId}
        wrap={isWrapped}
        lineNumbers
        className={cn(isLong && !isExpanded && "max-h-96 scroll-fade-y overflow-y-hidden")}
      >
        {lines.map((line, index) => (
          // The lines of a result never move: their position is their identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above.
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
      {isLong ? (
        <CodeBlockFooter className="justify-center">
          <Button
            variant="ghost"
            size="xs"
            aria-expanded={isExpanded}
            aria-controls={contentId}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ChevronDownIcon
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
