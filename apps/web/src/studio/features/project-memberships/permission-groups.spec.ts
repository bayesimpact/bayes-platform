import { describe, expect, it } from "vitest"
import { groupPermissions } from "./permission-groups"

describe("groupPermissions", () => {
  it("groups keys by area in a fixed order, and sorts each group read, create, update, delete", () => {
    const groups = groupPermissions([
      "csv_extraction_run.delete",
      "project.read",
      "csv_extraction_run.read",
      "desk.ui.read",
      "csv_extraction_run.create",
    ])

    expect(groups).toEqual([
      { key: "project", permissions: ["project.read"] },
      { key: "apps", permissions: ["desk.ui.read"] },
      {
        key: "csvExtractionRun",
        permissions: [
          "csv_extraction_run.read",
          "csv_extraction_run.create",
          "csv_extraction_run.delete",
        ],
      },
    ])
  })

  it("picks the most specific area for nested keys", () => {
    const groups = groupPermissions([
      "evaluation.ui.read",
      "evaluation.extraction.run.read",
      "csv_extraction_run.playground.read",
      "document_tag.read",
      "document.read",
    ])

    expect(groups.map((group) => [group.key, group.permissions])).toEqual([
      ["apps", ["evaluation.ui.read"]],
      ["document", ["document.read"]],
      ["documentTag", ["document_tag.read"]],
      ["csvExtractionRunPlayground", ["csv_extraction_run.playground.read"]],
      ["evaluationExtraction", ["evaluation.extraction.run.read"]],
    ])
  })

  it("puts keys of an unknown area last, under other", () => {
    expect(groupPermissions(["something.new", "agent.read"])).toEqual([
      { key: "agent", permissions: ["agent.read"] },
      { key: "other", permissions: ["something.new"] },
    ])
  })
})
