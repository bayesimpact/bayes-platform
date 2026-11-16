import { describe, expect, it } from "vitest"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import { buildComparison } from "./AgentSettingsExplorer"

const project = projectFactory.transient({ organization: organizationFactory.build() }).build()
const agent = agentFactory.transient({ project }).build({ id: "agent-id" })

/** Revisions newest first, as the history endpoint returns them. */
const buildVersions = (
  ...revisions: { revision: number; isDraft?: boolean; isProduction?: boolean }[]
) =>
  revisions.map(({ revision, isDraft, isProduction }) =>
    agentSettingsFactory
      .transient({ agent })
      .build({ agentId: "agent-id", revision, isDraft, isProduction }),
  )

describe("buildComparison", () => {
  it("selects the draft and diffs it against the production version by default", () => {
    const versions = buildVersions(
      { revision: 21, isDraft: true },
      { revision: 20, isProduction: true },
    )

    const comparison = buildComparison(versions, null, "current")

    expect(comparison?.selected.revision).toBe(21)
    expect(comparison?.effectiveMode).toBe("current")
    expect(comparison?.before.revision).toBe(20)
    expect(comparison?.after.revision).toBe(21)
  })

  it("offers all three comparisons for a version older than both the production one and the draft", () => {
    const versions = buildVersions(
      { revision: 21, isDraft: true },
      { revision: 20, isProduction: true },
      { revision: 19 },
    )

    const comparison = buildComparison(versions, 19, "current")

    expect(comparison?.hasDraft).toBe(true)
    expect(comparison?.availability).toEqual({ previous: false, current: true, draft: true })
  })

  it("diffs against the production version in current mode, not the newer draft", () => {
    const versions = buildVersions(
      { revision: 21, isDraft: true },
      { revision: 20, isProduction: true },
      { revision: 19 },
    )

    const comparison = buildComparison(versions, 19, "current")

    expect(comparison?.before.revision).toBe(19)
    expect(comparison?.after.revision).toBe(20)
  })

  it("diffs against the draft in draft mode", () => {
    const versions = buildVersions(
      { revision: 21, isDraft: true },
      { revision: 20, isProduction: true },
      { revision: 19 },
    )

    const comparison = buildComparison(versions, 19, "draft")

    expect(comparison?.before.revision).toBe(19)
    expect(comparison?.after.revision).toBe(21)
  })

  it("hides the draft comparison when the agent has no draft", () => {
    const versions = buildVersions({ revision: 20, isProduction: true }, { revision: 19 })

    const comparison = buildComparison(versions, 19, "draft")

    expect(comparison?.hasDraft).toBe(false)
    expect(comparison?.availability.draft).toBe(false)
    // Falls back to a comparison that is actually possible.
    expect(comparison?.effectiveMode).toBe("current")
    expect(comparison?.after.revision).toBe(20)
  })

  it("keeps the draft itself out of its own comparison targets", () => {
    const versions = buildVersions(
      { revision: 21, isDraft: true },
      { revision: 20, isProduction: true },
    )

    const comparison = buildComparison(versions, 21, "draft")

    expect(comparison?.availability).toEqual({ previous: true, current: true, draft: false })
    expect(comparison?.effectiveMode).toBe("previous")
  })

  it("diffs a saved version newer than production from production to it", () => {
    const versions = buildVersions(
      { revision: 22 },
      { revision: 21 },
      { revision: 20, isProduction: true },
    )

    const comparison = buildComparison(versions, 22, "current")

    expect(comparison?.availability.current).toBe(true)
    expect(comparison?.before.revision).toBe(20)
    expect(comparison?.after.revision).toBe(22)
  })

  it("offers no production comparison on the production version itself", () => {
    const versions = buildVersions({ revision: 21 }, { revision: 20, isProduction: true })

    const comparison = buildComparison(versions, 20, "current")

    expect(comparison?.availability.current).toBe(false)
  })

  it("returns no comparison for an empty history", () => {
    expect(buildComparison([], null, "current")).toBeNull()
  })

  it("marks a single-version history as having nothing to compare", () => {
    const versions = buildVersions({ revision: 1 })

    const comparison = buildComparison(versions, null, "current")

    expect(comparison?.isLatest).toBe(true)
    expect(comparison?.availability).toEqual({ previous: false, current: false, draft: false })
  })
})
