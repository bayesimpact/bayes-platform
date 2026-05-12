import { Button } from "@caseai-connect/ui/shad/button"
import { Item, ItemTitle } from "@caseai-connect/ui/shad/item"
import { Label } from "@caseai-connect/ui/shad/label"
import { Popover, PopoverContent, PopoverTrigger } from "@caseai-connect/ui/shad/popover"
import { FileTextIcon, GlobeIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { AgentSessionMessage as AgentSessionMessageType } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.models"

type Source = {
  documentId: string
  documentTitle?: string
  documentSourceType?: string
  chunks: {
    chunkId: string
    partialContent: string
  }[]
}

export function SourcesTool({
  toolCall,
}: {
  toolCall: NonNullable<AgentSessionMessageType["toolCalls"]>[number]
}) {
  const { t } = useTranslation()
  const sources = toolCall.arguments.sources as unknown as Source[]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground text-xs">
          {t("agent:source", { count: sources.length })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-96 overflow-y-auto" align="start" sideOffset={-4}>
        {sources.length > 1 && <Label className="text-base font-semibold">Sources</Label>}
        {sources.map((source) => {
          const isWebCrawl = source.documentSourceType === "webCrawl"
          return (
            <div key={source.documentId} className="grid grid-cols-1 gap-2 mt-3">
              {source.documentTitle ? (
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  {isWebCrawl ? (
                    <GlobeIcon className="size-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <FileTextIcon className="size-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate">{source.documentTitle}</span>
                </div>
              ) : null}
              {source.chunks.map((chunk) => (
                <Item variant="muted" key={chunk.chunkId}>
                  <ItemTitle>{chunk.partialContent}</ItemTitle>
                </Item>
              ))}
            </div>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
