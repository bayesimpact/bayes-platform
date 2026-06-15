import { Button } from "@caseai-connect/ui/shad/button"
import { Item, ItemTitle } from "@caseai-connect/ui/shad/item"
import { Label } from "@caseai-connect/ui/shad/label"
import { Popover, PopoverContent, PopoverTrigger } from "@caseai-connect/ui/shad/popover"
import { DownloadIcon, FileTextIcon, GlobeIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { AgentSessionMessage as AgentSessionMessageType } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.models"
import { useAppDispatch } from "@/common/store/hooks"
import { getDocumentTemporaryUrl } from "@/studio/features/documents/documents.thunks"

type Source = {
  documentId: string
  documentTitle?: string
  documentSourceType?: string
  isPublicDocument?: boolean
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
  const dispatch = useAppDispatch()
  const sources = toolCall.arguments.sources as unknown as Source[]

  const handleDownload = async (documentId: string) => {
    const result = await dispatch(getDocumentTemporaryUrl({ documentId })).unwrap()
    const anchor = window.document.createElement("a")
    anchor.href = result.url
    anchor.download = ""
    anchor.target = "_blank"
    anchor.click()
  }

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
                  {source.isPublicDocument ? (
                    <button
                      type="button"
                      onClick={() => handleDownload(source.documentId)}
                      className="truncate hover:underline text-left"
                    >
                      {source.documentTitle}
                    </button>
                  ) : (
                    <span className="truncate">{source.documentTitle}</span>
                  )}
                  {source.isPublicDocument && (
                    <button
                      type="button"
                      onClick={() => handleDownload(source.documentId)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label={t("document:download")}
                    >
                      <DownloadIcon className="size-3.5" />
                    </button>
                  )}
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
