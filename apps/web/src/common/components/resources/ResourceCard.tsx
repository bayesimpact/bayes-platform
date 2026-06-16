import { ExternalLinkIcon, PlayIcon } from "lucide-react"
import { useState } from "react"

export type ResourceCardData = {
  title: string
  description?: string
  link: string
}

/** Absolutizes uploaded-file links (relative API paths) against the API base URL. */
export function resolveLink(link: string): string {
  if (/^https?:\/\//.test(link)) return link
  const baseUrl = import.meta.env.VITE_API_URL as string
  return `${baseUrl}${link}`
}

/** Extracts a YouTube video id from common URL shapes, or null. */
function getYouTubeId(link: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = link.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

function hasImageExtension(link: string): boolean {
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(link)
}

/** Our own public download endpoint — the target may be an image (rendered) or not (fallback). */
function isResourceFileEndpoint(link: string): boolean {
  return /\/resource-libraries\/[^/]+\/resources\/[^/]+\/file$/.test(link)
}

/**
 * Renders a single resource exactly as the assistant surfaces it in chat. Shared between the chat
 * `SurfaceResourcesTool` and the resource-library editor preview so the two stay in sync.
 */
export function ResourceCard({ resource }: { resource: ResourceCardData }) {
  const [mediaFailed, setMediaFailed] = useState(false)

  const href = resolveLink(resource.link)
  const youTubeId = getYouTubeId(resource.link)
  const canTryImage =
    !youTubeId && (hasImageExtension(resource.link) || isResourceFileEndpoint(resource.link))
  const showMedia = !mediaFailed && (youTubeId !== null || canTryImage)

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group block w-fit max-w-md overflow-hidden rounded-xl border bg-background transition-colors hover:bg-muted"
    >
      {showMedia &&
        (youTubeId ? (
          <div className="relative aspect-video w-full overflow-hidden bg-muted">
            <img
              src={`https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`}
              alt={resource.title}
              className="size-full object-cover"
              onError={() => setMediaFailed(true)}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-black/70 text-white">
                <PlayIcon className="size-6 translate-x-0.5 fill-current" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex max-h-72 w-full justify-center bg-muted">
            <img
              src={href}
              alt={resource.title}
              className="max-h-72 w-auto object-contain"
              onError={() => setMediaFailed(true)}
            />
          </div>
        ))}

      <div className="flex items-start justify-between gap-3 p-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{resource.title}</span>
          {resource.description && (
            <span className="text-xs text-muted-foreground">{resource.description}</span>
          )}
        </div>
        <ExternalLinkIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
      </div>
    </a>
  )
}
