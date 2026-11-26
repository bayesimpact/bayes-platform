import { DESK_UI_READ_PERMISSION, PROJECT_READ_PERMISSION } from "@bayes-platform/desk-contracts"
import { describe, expect, it } from "vitest"
import { listDeskProjects } from "./desk-projects"

const blue = { id: crypto.randomUUID(), name: "Blue organization" }
const amber = { id: crypto.randomUUID(), name: "Amber organization" }

const project = (
  name: string,
  organizationId: string,
  permissions = [PROJECT_READ_PERMISSION, DESK_UI_READ_PERMISSION],
) => ({
  id: crypto.randomUUID(),
  name,
  organizationId,
  permissions,
  featureFlags: [],
})

describe("listDeskProjects", () => {
  it("keeps the projects that grant desk.ui.read, sorted by organization then project", () => {
    const projects = [
      project("Reports", blue.id),
      project("Support", amber.id),
      project("Pricing", blue.id),
      project("Billing", blue.id, [PROJECT_READ_PERMISSION]),
    ]

    const deskProjects = listDeskProjects(projects, [blue, amber])

    expect(
      deskProjects.map((deskProject) => [deskProject.organization.name, deskProject.name]),
    ).toEqual([
      ["Amber organization", "Support"],
      ["Blue organization", "Pricing"],
      ["Blue organization", "Reports"],
    ])
  })

  it("leaves out a project whose organization the person cannot read", () => {
    expect(listDeskProjects([project("Pricing", crypto.randomUUID())], [blue])).toEqual([])
  })
})
