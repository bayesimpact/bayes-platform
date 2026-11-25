import { randomUUID } from "node:crypto"
import { ToolName } from "@bayes-platform/api-contracts"
import type { ResourceLibrary } from "@/domains/resource-libraries/resource-library.entity"
import { promptHelpers } from "./helpers"

function buildLibrary(overrides: Partial<ResourceLibrary> = {}): ResourceLibrary {
  return {
    id: overrides.id ?? "lib-1",
    organizationId: overrides.organizationId ?? "org-1",
    projectId: overrides.projectId ?? "proj-1",
    title: overrides.title ?? "Getting Started",
    resources: overrides.resources ?? [],
    agents: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as ResourceLibrary
}

describe("promptHelpers.resourceLibraries", () => {
  it("returns an empty string when no library has resources", () => {
    expect(promptHelpers.resourceLibraries([])).toBe("")
    expect(promptHelpers.resourceLibraries([buildLibrary({ resources: [] })])).toBe("")
  })

  it("lists resources under short aliases, with NO real id and NO link", () => {
    const text = promptHelpers.resourceLibraries([
      buildLibrary({
        title: "Videos",
        resources: [
          {
            id: "res-1",
            title: "Intro",
            description: "An intro video",
            linkType: "url",
            url: "https://example.com/video",
          },
        ],
      }),
    ])

    expect(text).toContain("### Videos")
    expect(text).toContain("r1: Intro")
    expect(text).toContain(ToolName.SurfaceResources)
    // Real ids and links must never reach the prompt: exposed links were
    // getting recited into user-visible answers by small models.
    expect(text).not.toContain("res-1")
    expect(text).not.toContain("https://example.com/video")
    expect(text).not.toContain("link:")
  })

  it("numbers aliases across libraries in listing order", () => {
    const text = promptHelpers.resourceLibraries([
      buildLibrary({
        title: "Videos",
        resources: [
          { id: "a", title: "Intro", description: "d", linkType: "url", url: "https://x.test/1" },
          {
            id: "b",
            title: "Deep dive",
            description: "d",
            linkType: "url",
            url: "https://x.test/2",
          },
        ],
      }),
      buildLibrary({
        id: "lib-2",
        title: "Docs",
        resources: [
          {
            id: "c",
            title: "Handbook",
            description: "d",
            linkType: "url",
            url: "https://x.test/3",
          },
        ],
      }),
    ])

    expect(text).toContain("r1: Intro")
    expect(text).toContain("r2: Deep dive")
    expect(text).toContain("r3: Handbook")
  })

  it("serializes matching hints only when present, labeling them as match-only", () => {
    const withoutHints = promptHelpers.resourceLibraries([
      buildLibrary({
        resources: [
          {
            id: "res-1",
            title: "Intro",
            description: "An intro video",
            linkType: "url",
            url: "https://example.com/video",
          },
        ],
      }),
    ])
    expect(withoutHints).not.toContain("do NOT show to the user")

    const withHints = promptHelpers.resourceLibraries([
      buildLibrary({
        resources: [
          {
            id: "res-1",
            title: "Intro",
            description: "An intro video",
            matchingHints: "onboarding, getting started, first login",
            linkType: "url",
            url: "https://example.com/video",
          },
        ],
      }),
    ])
    expect(withHints).toContain("onboarding, getting started, first login")
    expect(withHints).toContain("do NOT show to the user")
  })

  it("keeps file resources' internal download path out of the prompt", () => {
    const resourceId = randomUUID()
    const text = promptHelpers.resourceLibraries([
      buildLibrary({
        id: "lib-9",
        organizationId: "org-9",
        projectId: "proj-9",
        resources: [
          {
            id: resourceId,
            title: "Handbook",
            description: "The handbook",
            linkType: "file",
            file: {
              storageRelativePath: "org-9/proj-9/handbook.pdf",
              fileName: "handbook.pdf",
              mimeType: "application/pdf",
            },
          },
        ],
      }),
    ])

    expect(text).toContain("r1: Handbook")
    expect(text).not.toContain("/organizations/")
    expect(text).not.toContain(resourceId)
  })
})
