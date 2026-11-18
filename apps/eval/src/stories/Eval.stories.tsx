import { EvalProjectsRoutes } from "@caseai-connect/eval-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { delay } from "msw"
import { userEvent, within } from "storybook/test"
import { agentUrlOf } from "@/test/eval-urls"
import {
  buildCampaignManagerWorld,
  buildEveryAccessWorld,
  buildManyAgentsWorld,
  buildNoAgentWorld,
  buildNoEvaluationAccessWorld,
  buildPendingInvitationsWorld,
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

/**
 * A person who evaluates an agent and manages its review campaigns: the agent's first page is a
 * hub of both sections, which the sidebar lists too.
 */
export const Home: Story = {}

/**
 * The sidebar hidden, then peeking over the page while the pointer rests on the button that shows
 * it, as in Claude Desktop. It hides a moment after the pointer leaves the button and the sidebar.
 */
export const SidebarPeek: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("button", { name: "Hide the sidebar" }))
    await userEvent.hover(await canvas.findByRole("button", { name: "Show the sidebar" }))
  },
}

/** The same person, who also tests a campaign and reviews another: every part of the app at once. */
export const EveryAccess: Story = {
  parameters: evaluation({ world: buildEveryAccessWorld }),
}

/**
 * The same person, with two invitations to answer: the envelope beside their menu opens them, to
 * accept or decline each one, as in the Desk.
 */
export const PendingInvitations: Story = {
  parameters: evaluation({ world: buildPendingInvitationsWorld }),
}

/** An owner who is not an evaluator: the agent opens on its review campaigns, its only section. */
export const CampaignManagerOnly: Story = {
  parameters: evaluation({ world: buildCampaignManagerWorld }),
}

/**
 * An evaluator with agents of several projects and organizations: the home opens the first one,
 * with the command center over it, so the person can go elsewhere at once.
 */
export const SeveralProjects: Story = {
  parameters: evaluation({ world: buildSeveralProjectsWorld }),
}

/**
 * An evaluator of many projects with several agents each: the command center, which the home
 * opens and ⌘K or Ctrl+K opens again, lists them by project and finds one by its names.
 */
export const ManyAgents: Story = {
  parameters: evaluation({ world: buildManyAgentsWorld }),
}

/**
 * One agent of the evaluator of several projects, who manages no campaign: it opens on its evaluations, its only
 * section, and the button at the top of the sidebar opens the command center.
 */
export const AgentAmongSeveral: Story = {
  parameters: evaluation({
    world: buildSeveralProjectsWorld,
    url: (world) => agentUrlOf(world, "Writing Helper"),
  }),
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
