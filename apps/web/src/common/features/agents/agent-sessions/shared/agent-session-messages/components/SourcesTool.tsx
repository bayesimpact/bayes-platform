import { Button } from "@caseai-connect/ui/shad/button"
import { Item, ItemTitle } from "@caseai-connect/ui/shad/item"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@caseai-connect/ui/shad/sheet"
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

function SourceItem({ source }: { source: Source }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const handleDownload = async (documentId: string) => {
    const result = await dispatch(getDocumentTemporaryUrl({ documentId })).unwrap()
    const anchor = window.document.createElement("a")
    anchor.href = result.url
    anchor.download = ""
    anchor.target = "_blank"
    anchor.click()
  }

  const isWebCrawl = source.documentSourceType === "webCrawl"
  // Only uploaded files have a downloadable artifact; crawled pages have
  // no stored file, so the download affordance is hidden for them.
  const isDownloadable = Boolean(source.isPublicDocument) && !isWebCrawl

  return (
    <div className="grid grid-cols-1 gap-2 mt-3">
      {source.documentTitle && (
        <div className="flex items-center gap-2 font-medium">
          {isWebCrawl ? (
            <GlobeIcon className="size-6 text-muted-foreground shrink-0" />
          ) : (
            <FileTextIcon className="size-6 text-muted-foreground shrink-0" />
          )}

          <span className="flex flex-wrap">{source.documentTitle}</span>
        </div>
      )}

      {source.chunks.map((chunk) => (
        <Item variant="muted" key={chunk.chunkId}>
          <ItemTitle>{chunk.partialContent}</ItemTitle>
        </Item>
      ))}

      {isDownloadable && (
        <Button variant="outline" onClick={() => handleDownload(source.documentId)}>
          {t("actions:downloadDocument")}
          <DownloadIcon />
        </Button>
      )}
    </div>
  )
}

export function SourcesTool({
  toolCall,
}: {
  toolCall: NonNullable<AgentSessionMessageType["toolCalls"]>[number]
}) {
  const { t } = useTranslation()
  const sources = toolCall.arguments.sources as unknown as Source[]

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground text-xs">
          {t("agent:source", { count: sources.length })}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("agent:source", { count: sources.length })}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4">
          {sources.map((source) => (
            <SourceItem key={source.documentId} source={source} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
