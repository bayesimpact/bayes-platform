import {
  DESK_UI_READ_PERMISSION,
  EVALUATION_UI_READ_PERMISSION,
  PROJECT_READ_PERMISSION,
} from "@caseai-connect/eval-contracts"
import { describe, expect, it } from "vitest"
import { listEvaluationProjects } from "./evaluation-projects"

const blue = { id: crypto.randomUUID(), name: "Blue organization" }
const amber = { id: crypto.randomUUID(), name: "Amber organization" }

const project = (
  name: string,
  organizationId: string,
  permissions: string[] = [PROJECT_READ_PERMISSION, EVALUATION_UI_READ_PERMISSION],
) => ({ id: crypto.randomUUID(), name, organizationId, permissions })

describe("listEvaluationProjects", () => {
  it("keeps the projects that grant evaluation.ui.read, sorted by organization then project", () => {
    const projects = [
      project("Reports", blue.id),
      project("Support", amber.id),
      project("Pricing", blue.id),
      project("Billing", blue.id, [PROJECT_READ_PERMISSION, DESK_UI_READ_PERMISSION]),
    ]

    const evaluationProjects = listEvaluationProjects(projects, [blue, amber])

    expect(
      evaluationProjects.map((evaluationProject) => [
        evaluationProject.organization.name,
        evaluationProject.name,
      ]),
    ).toEqual([
      ["Amber organization", "Support"],
      ["Blue organization", "Pricing"],
      ["Blue organization", "Reports"],
    ])
  })

  it("leaves out a project whose organization the person cannot read", () => {
    expect(listEvaluationProjects([project("Pricing", crypto.randomUUID())], [blue])).toEqual([])
  })
})
