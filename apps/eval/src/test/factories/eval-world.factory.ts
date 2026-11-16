import type {
  MyOrganizationOutputDto,
  MyProjectOutputDto,
  ProjectAgentOutputDto,
} from "@caseai-connect/eval-contracts"
import { buildProjectAgent } from "./agents.factory"
import { buildMyOrganization, buildMyProject } from "./projects.factory"

/** Everything the mocked API answers: the person's organizations, projects and their agents. */
export type EvalWorld = {
  organizations: MyOrganizationOutputDto[]
  projects: MyProjectOutputDto[]
  agents: ProjectAgentOutputDto[]
}

/** The main case: the evaluator of one project, with one agent. */
export function buildEvalWorld(): EvalWorld {
  const organization = buildMyOrganization()
  const project = buildMyProject(organization)
  return {
    organizations: [organization],
    projects: [project],
    agents: [buildProjectAgent(project)],
  }
}

/**
 * The evaluator of two projects in two organizations, with agents of both types, and a project
 * that opens the Desk only, whose agents stay out of the switcher.
 */
export function buildSeveralProjectsWorld(): EvalWorld {
  const product = buildMyOrganization({ name: "Product" })
  const operations = buildMyOrganization({ name: "Operations" })
  const pricing = buildMyProject(product, { name: "Pricing" })
  const onboarding = buildMyProject(operations, { name: "Onboarding" })
  const deskOnly = buildMyProject(operations, {
    name: "Help desk",
    permissions: ["project.read", "desk.ui.read"],
  })
  return {
    organizations: [product, operations],
    projects: [pricing, onboarding, deskOnly],
    agents: [
      buildProjectAgent(pricing, { name: "Helpful Assistant" }),
      buildProjectAgent(pricing, { name: "Document Reader", type: "extraction" }),
      buildProjectAgent(onboarding, { name: "Writing Helper" }),
      buildProjectAgent(deskOnly, { name: "Support Assistant" }),
    ],
  }
}

/** The evaluator of a project that has no agent yet. */
export function buildNoAgentWorld(): EvalWorld {
  const organization = buildMyOrganization()
  return { organizations: [organization], projects: [buildMyProject(organization)], agents: [] }
}

/** A person who holds no evaluator role: their only project opens the Desk alone. */
export function buildNoEvaluationAccessWorld(): EvalWorld {
  const organization = buildMyOrganization()
  const project = buildMyProject(organization, {
    name: "Support",
    permissions: ["project.read", "desk.ui.read"],
  })
  return {
    organizations: [organization],
    projects: [project],
    agents: [buildProjectAgent(project)],
  }
}
