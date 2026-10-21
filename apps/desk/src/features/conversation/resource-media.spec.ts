import { describe, expect, it } from "vitest"
import { resourceMediaOf, youtubeIdOf } from "./resource-media"

describe("youtubeIdOf", () => {
  it("reads the id of the usual YouTube links", () => {
    for (const link of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?t=42",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    ]) {
      expect(youtubeIdOf(link)).toBe("dQw4w9WgXcQ")
    }
    expect(youtubeIdOf("https://example.org/watch?v=dQw4w9WgXcQ")).toBeNull()
  })
})

describe("resourceMediaOf", () => {
  it("previews a video's thumbnail, an image or a library file, and nothing else", () => {
    expect(resourceMediaOf("https://youtu.be/dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ")).toEqual(
      {
        kind: "youtube",
        thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      },
    )
    expect(
      resourceMediaOf("https://example.org/chart.png", "https://example.org/chart.png"),
    ).toEqual({ kind: "image", url: "https://example.org/chart.png" })
    expect(resourceMediaOf("https://example.org/plans", "https://example.org/plans")).toBeNull()
  })
})
