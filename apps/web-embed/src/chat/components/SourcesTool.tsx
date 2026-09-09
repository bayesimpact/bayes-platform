import { type AgentSessionToolCallDto, ToolName } from "@caseai-connect/api-contracts"
import { ChevronRightIcon, FileTextIcon, GlobeIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

type Source = {
  documentId: string
  documentTitle?: string
  documentSourceType?: string
  chunks: {
    chunkId: string
    partialContent: string
  }[]
}

function isSourceChunk(value: unknown): value is Source["chunks"][number] {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.chunkId === "string" && typeof candidate.partialContent === "string"
}

function isSource(value: unknown): value is Source {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.documentId === "string" && Array.isArray(candidate.chunks)
}

function parseSources(args: Record<string, unknown>): Source[] {
  const sources = args.sources
  if (!Array.isArray(sources)) return []
  return sources.filter(isSource).map((source) => ({
    ...source,
    chunks: source.chunks.filter(isSourceChunk),
  }))
}

export function findSourcesTool(
  toolCalls: AgentSessionToolCallDto[] | undefined,
): AgentSessionToolCallDto | undefined {
  return toolCalls?.find((toolCall) => toolCall.name === ToolName.Sources)
}

export function hasCitedSources(toolCalls: AgentSessionToolCallDto[] | undefined): boolean {
  const toolCall = findSourcesTool(toolCalls)
  return toolCall !== undefined && parseSources(toolCall.arguments).length > 0
}

export function SourcesTool({ toolCall }: { toolCall: AgentSessionToolCallDto }) {
  const { t } = useTranslation("chat")
  const sources = parseSources(toolCall.arguments)
  if (sources.length === 0) return null

  return (
    <details className="mt-1 group">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-0.5 rounded-lg px-1.5 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="size-3.5 shrink-0 transition-transform group-open:rotate-90" />
        {t("message.sources", { count: sources.length })}
      </summary>
      <div className="mt-2 flex flex-col gap-3">
        {sources.map((source) => (
          <SourceItem key={source.documentId} source={source} />
        ))}
      </div>
    </details>
  )
}

function SourceItem({ source }: { source: Source }) {
  const isWebCrawl = source.documentSourceType === "webCrawl"

  return (
    <div className="flex flex-col gap-2">
      {source.documentTitle && (
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          {isWebCrawl ? (
            <GlobeIcon className="size-4 shrink-0 text-gray-400" />
          ) : (
            <FileTextIcon className="size-4 shrink-0 text-gray-400" />
          )}
          <span>{source.documentTitle}</span>
        </div>
      )}
      {source.chunks.map((chunk) => (
        <p
          key={chunk.chunkId}
          className="rounded-lg bg-gray-100 px-3 py-2 text-xs leading-5 text-gray-700"
        >
          {chunk.partialContent}
        </p>
      ))}
    </div>
  )
}
