import { randomUUID } from "node:crypto"
import { ToolName } from "@caseai-connect/api-contracts"
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

  it("serializes url resources with their url as the link", () => {
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
    expect(text).toContain("id: res-1")
    expect(text).toContain("link: https://example.com/video")
    expect(text).toContain(ToolName.SurfaceResources)
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

  it("serializes file resources with the public download path as the link", () => {
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

    expect(text).toContain(
      `link: /organizations/org-9/projects/proj-9/resource-libraries/lib-9/resources/${resourceId}/file`,
    )
  })
})
