import { describe, expect, it } from "vitest"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSessionMessageFactory } from "@/common/features/agents/agent-sessions/agent-session.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import { agentSettingsFactory } from "./agent-settings.factory"
import {
  findDraftVersion,
  findLatestSavedVersion,
  findProductionVersion,
  findVersion,
  resolveEffectiveRevision,
  resolveMessageRevision,
} from "./agent-settings.functions"

const project = projectFactory.transient({ organization: organizationFactory.build() }).build()
const agent = agentFactory.transient({ project }).build()

/** Revisions newest first, as the history endpoint returns them. */
const buildVersions = (
  ...revisions: { revision: number; isDraft?: boolean; isProduction?: boolean }[]
) =>
  revisions.map(({ revision, isDraft, isProduction }) =>
    agentSettingsFactory
      .transient({ agent })
      .build({ id: "agent-id", revision, isDraft, isProduction }),
  )

describe("findProductionVersion", () => {
  it("returns the production version, even when newer versions are saved", () => {
    const versions = buildVersions(
      { revision: 5, isDraft: true },
      { revision: 4 },
      { revision: 3, isProduction: true },
    )

    expect(findProductionVersion(versions)?.revision).toBe(3)
  })

  it("returns undefined when nothing was ever saved", () => {
    expect(findProductionVersion(buildVersions({ revision: 1, isDraft: true }))).toBeUndefined()
  })
})

describe("findLatestSavedVersion", () => {
  it("returns the newest saved version, even when an older one is in production", () => {
    const versions = buildVersions(
      { revision: 5, isDraft: true },
      { revision: 4 },
      { revision: 3, isProduction: true },
    )

    expect(findLatestSavedVersion(versions)?.revision).toBe(4)
  })

  it("returns undefined when nothing was ever saved", () => {
    expect(findLatestSavedVersion(buildVersions({ revision: 1, isDraft: true }))).toBeUndefined()
  })
})

describe("findVersion", () => {
  it("returns the version matching the revision", () => {
    const versions = buildVersions({ revision: 4 }, { revision: 3 })

    expect(findVersion(versions, 3)?.revision).toBe(3)
  })

  it("returns undefined for a revision missing from the list", () => {
    expect(findVersion(buildVersions({ revision: 4 }), 2)).toBeUndefined()
  })
})

describe("resolveMessageRevision", () => {
  it("uses the revision recorded on the message", () => {
    const message = agentSessionMessageFactory.build({ role: "assistant", agentRevision: 3 })

    expect(resolveMessageRevision(message, 4)).toBe(3)
  })

  it("labels a still-unsaved streamed message with the version being run", () => {
    // Messages built client-side during streaming have no `createdAt` and no revision. The
    // caller passes whichever version the playground is currently set to, which is what the
    // stream ran with — not necessarily the published one, now that a draft can be selected.
    const message = agentSessionMessageFactory.build({ role: "assistant" })

    expect(resolveMessageRevision(message, 5)).toBe(5)
  })

  it("hides the badge for a server-loaded message with no revision", () => {
    // A persisted message always has `createdAt`. If its revision is missing the transport
    // dropped it, and claiming the running revision would mislabel an old message — so report
    // nothing instead.
    const message = agentSessionMessageFactory.build({
      role: "assistant",
      createdAt: Date.now() - 1000 * 60 * 60,
    })

    expect(resolveMessageRevision(message, 4)).toBeUndefined()
  })

  it("returns undefined when there is no recorded revision and no fallback", () => {
    const message = agentSessionMessageFactory.build({ role: "assistant" })

    expect(resolveMessageRevision(message, undefined)).toBeUndefined()
  })

  it("prefers the recorded revision over the fallback on a persisted message", () => {
    const message = agentSessionMessageFactory.build({
      role: "assistant",
      agentRevision: 2,
      createdAt: Date.now() - 1000 * 60,
    })

    expect(resolveMessageRevision(message, 4)).toBe(2)
  })
})

describe("findDraftVersion", () => {
  it("returns the draft version", () => {
    const versions = buildVersions({ revision: 5, isDraft: true }, { revision: 4 })

    expect(findDraftVersion(versions)?.revision).toBe(5)
  })

  it("returns undefined when every version is published", () => {
    expect(findDraftVersion(buildVersions({ revision: 4 }, { revision: 3 }))).toBeUndefined()
  })
})

describe("resolveEffectiveRevision", () => {
  it("honours an explicit choice", () => {
    const versions = buildVersions({ revision: 5, isDraft: true }, { revision: 4 }, { revision: 3 })

    expect(resolveEffectiveRevision({ versions, chosenRevision: 3 })).toBe(3)
  })

  it("defaults to the draft when there is no explicit choice", () => {
    const versions = buildVersions({ revision: 5, isDraft: true }, { revision: 4 })

    expect(resolveEffectiveRevision({ versions, chosenRevision: undefined })).toBe(5)
  })

  it("defaults to the newest saved version, not an older one in production, when there is no draft", () => {
    const versions = buildVersions({ revision: 4 }, { revision: 3, isProduction: true })

    expect(resolveEffectiveRevision({ versions, chosenRevision: undefined })).toBe(4)
  })

  it("falls back to the default when the chosen revision left the list", () => {
    // Another tab archived revision 3 while it was selected here. Keeping the stale number would
    // send the API a revision it rejects, so the default takes over instead.
    const versions = buildVersions({ revision: 5, isDraft: true }, { revision: 4 })

    expect(resolveEffectiveRevision({ versions, chosenRevision: 3 })).toBe(5)
  })

  it("returns undefined when the history is empty", () => {
    expect(resolveEffectiveRevision({ versions: [], chosenRevision: undefined })).toBeUndefined()
  })
})
