import { runtimeConfig } from "@/config/runtime-config"
import { getAccessToken } from "@/external/auth0Client"

function parseSSEEvent<TDto>(eventText: string, label: string): TDto | null {
  const dataLine = eventText.split("\n").find((line) => line.startsWith("data: "))
  if (!dataLine) return null

  try {
    return JSON.parse(dataLine.slice(6)) as TDto
  } catch (parseError) {
    console.error(`Failed to parse ${label} SSE event:`, parseError, "Data:", dataLine.slice(6))
    return null
  }
}

function processSSEChunk<TDto, TEvent>(
  chunk: string,
  config: SSEStreamConfig<TDto, TEvent>,
  onEvent: (event: TEvent) => void,
): { remaining: string; done: boolean } {
  const parts = chunk.split("\n\n")
  const remaining = parts.pop() ?? ""

  for (const eventText of parts) {
    if (!eventText.trim()) continue
    const dto = parseSSEEvent<TDto>(eventText, config.label)
    if (!dto) continue
    if (!config.isExpectedEvent(dto)) continue
    onEvent(config.fromDto(dto))
  }

  return { remaining, done: false }
}

export interface SSEStreamConfig<TDto, TEvent> {
  label: string
  getStreamPath: (params: { organizationId: string; projectId: string }) => string
  isExpectedEvent: (dto: TDto) => boolean
  fromDto: (dto: TDto) => TEvent
}

export async function readSSEStream<TDto, TEvent>(params: {
  config: SSEStreamConfig<TDto, TEvent>
  organizationId: string
  projectId: string
  signal?: AbortSignal
  onStatusChanged: (event: TEvent) => void
}): Promise<void> {
  const { config, onStatusChanged } = params
  const token = await getAccessToken()
  const baseURL = runtimeConfig.apiUrl
  const streamPath = config.getStreamPath({
    organizationId: params.organizationId,
    projectId: params.projectId,
  })

  const response = await fetch(`${baseURL}${streamPath}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
    signal: params.signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error")
    throw new Error(`${config.label} SSE failed: ${response.status} ${errorText}`)
  }

  if (!response.body) {
    throw new Error(`${config.label} SSE response body is null`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        if (buffer.trim())
          processSSEChunk(`${buffer}\n\n`, config, (event) => onStatusChanged(event))
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const result = processSSEChunk(buffer, config, (event) => onStatusChanged(event))
      buffer = result.remaining
      if (result.done) return
    }
  } finally {
    reader.releaseLock()
  }
}
