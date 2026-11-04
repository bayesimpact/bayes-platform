import { EVALUATION_UI_READ_PERMISSION } from "@caseai-connect/eval-contracts"
import { describe, expect, it } from "vitest"
import { listEvaluationProjects } from "./evaluation-projects"

const projectWith = (name: string, permissions: string[]) => ({
  id: crypto.randomUUID(),
  name,
  organizationId: crypto.randomUUID(),
  permissions,
})

describe("listEvaluationProjects", () => {
  it("keeps the projects that grant evaluation.ui.read, and no other", () => {
    const evaluated = projectWith("Pricing", ["project.read", EVALUATION_UI_READ_PERMISSION])
    const deskOnly = projectWith("Support", ["project.read", "desk.ui.read"])

    expect(listEvaluationProjects([evaluated, deskOnly])).toEqual([evaluated])
  })
})
