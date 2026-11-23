import { Button } from "@caseai-connect/ui/shad/button"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@caseai-connect/ui/shad/item"
import { cn } from "@caseai-connect/ui/utils"
import { useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { McpServerTool } from "../mcp-servers.models"

/**
 * One tool of a server. A description is cut at two lines so the list stays
 * scannable, and a description that was cut can be opened in full: it is what
 * the model reads to decide when to call the tool.
 */
export function McpServerToolItem({ tool }: { tool: McpServerTool }) {
  const { t } = useTranslation()
  const descriptionRef = useRef<HTMLParagraphElement>(null)
  const [isCut, setIsCut] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // Measured once, while the description is still clamped: whether it is cut
  // depends on the dialog's width, which no character count can tell.
  useLayoutEffect(() => {
    const description = descriptionRef.current
    if (description) setIsCut(description.scrollHeight > description.clientHeight + 1)
  }, [])

  return (
    <Item variant="outline" size="sm">
      <ItemContent>
        <ItemTitle className="font-mono">{tool.name}</ItemTitle>
        {tool.description && (
          <ItemDescription
            ref={descriptionRef}
            className={cn(isExpanded && "line-clamp-none whitespace-pre-line text-pretty")}
          >
            {tool.description}
          </ItemDescription>
        )}
        {isCut && (
          <Button
            variant="link"
            size="xs"
            className="self-start px-0"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? t("mcpServers:tools.showLess") : t("mcpServers:tools.showMore")}
          </Button>
        )}
      </ItemContent>
    </Item>
  )
}
