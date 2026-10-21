/** What a resource card previews above its title. */
export type ResourceMedia =
  | { kind: "youtube"; videoId: string; thumbnailUrl: string }
  | { kind: "image"; url: string }

const YOUTUBE_ID_PATTERNS = [
  /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/,
  /youtube\.com\/(?:embed|shorts)\/([\w-]{11})/,
]

/** The id of a YouTube video in its usual URL shapes, or `null`. */
export function youtubeIdOf(link: string): string | null {
  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const id = pattern.exec(link)?.[1]
    if (id) return id
  }
  return null
}

function isImageLink(link: string): boolean {
  return /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(link)
}

function isLibraryFile(link: string): boolean {
  return /\/resource-libraries\/[^/]+\/resources\/[^/]+\/file$/.test(link)
}

/**
 * The preview of a resource: a YouTube video's thumbnail, built from its id on YouTube's image
 * host, or the image itself for an image link or a library file, which may be one. The resources
 * come from the agent's curated libraries, not from the model's text. `null` for anything else.
 */
export function resourceMediaOf(link: string, url: string): ResourceMedia | null {
  const youtubeId = youtubeIdOf(link)
  if (youtubeId) {
    return {
      kind: "youtube",
      videoId: youtubeId,
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    }
  }
  if (isImageLink(link) || isLibraryFile(link)) return { kind: "image", url }
  return null
}

/** A video a resource card plays in the side panel. */
export type PlayedVideo = {
  title: string
  description: string | null
  videoId: string
  /** The video's page, which opens on YouTube. */
  url: string
}

/**
 * The player of a YouTube video, on YouTube's privacy-enhanced host, which sets no cookie until
 * the person plays it. It starts at once: the person just asked for it.
 */
export function youtubeEmbedUrlOf(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`
}
