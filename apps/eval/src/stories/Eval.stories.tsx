import { EvalProjectsRoutes } from "@caseai-connect/eval-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { delay } from "msw"
import {
  buildNoAgentWorld,
  buildNoEvaluationAccessWorld,
  buildSeveralProjectsWorld,
} from "@/test/factories/eval-world.factory"
import { apiError, mockRoute } from "@/test/msw/mock-route"
import { evaluation } from "@/test/msw/story-api"
import { evalMeta } from "./eval-meta"

/** The app around its pages: the agents and projects, the access, and its failures. */
const meta = {
  title: "Evaluation/General",
  ...evalMeta,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** The evaluator of one project with one agent: the sidebar shows the agent alone. */
export const Home: Story = {}

/** Agents of several projects and organizations, in the switcher at the top of the sidebar. */
export const SeveralProjects: Story = {
  parameters: evaluation({ world: buildSeveralProjectsWorld }),
}

/** The evaluator of a project that has no agent yet. */
export const NoAgent: Story = {
  parameters: evaluation({ world: buildNoAgentWorld }),
}

/** A person who is the evaluator of no project. */
export const NoEvaluationAccess: Story = {
  parameters: evaluation({ world: buildNoEvaluationAccessWorld }),
}

/** An agent that is not in the world, nor the person's. */
export const PageNotFound: Story = {
  parameters: evaluation({
    url: (world) =>
      `/eval/o/${world.organizations[0]?.id}/p/${world.projects[0]?.id}/a/${crypto.randomUUID()}`,
  }),
}

export const ProjectsFailToLoad: Story = {
  parameters: evaluation({
    handlers: () => [mockRoute(EvalProjectsRoutes.getAllMine, () => apiError(503))],
  }),
}

export const Loading: Story = {
  parameters: evaluation({
    handlers: () => [
      mockRoute(EvalProjectsRoutes.getAllMine, async () => {
        await delay("infinite")
        return []
      }),
    ],
  }),
}
