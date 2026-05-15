import type { ProjectMembershipRoleDto } from "@caseai-connect/api-contracts"
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite"
import { Provider } from "react-redux"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { projectMembershipFactory, userFactory } from "@/common/features/me/me.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import { buildMockStore } from "@/stories/decorators/with-redux"
import { mergeSeeds, seed } from "@/stories/seed"
import { evaluationReportFactory } from "@/studio/features/evaluation-reports/evaluation-reports.factory"
import type { EvaluationReport } from "@/studio/features/evaluation-reports/evaluation-reports.models"
import { evaluationFactory } from "@/studio/features/evaluations/evaluations.factory"
import { buildStudioPath, StudioRouteNames } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = {
  role: ProjectMembershipRoleDto
  withEvaluations?: boolean
  withEvaluationReports?: boolean
}

const ROLES: ProjectMembershipRoleDto[] = ["owner", "admin", "member"]

const organization = organizationFactory.build()
const project = projectFactory.transient({ organization }).build({ featureFlags: ["evaluation"] })
const projectPath = buildStudioPath(StudioRouteNames.EVALUATION)
  .replace(":organizationId", organization.id)
  .replace(":projectId", project.id)

function buildDecorator(): Decorator {
  return (Story, ctx) => {
    const { role, withEvaluations, withEvaluationReports } = ctx.args as StoryArgs
    const projectMemberships = [projectMembershipFactory.transient({ project }).build({ role })]
    const user = userFactory.transient({ projectMemberships }).build()
    const agents = agentFactory.transient({ project }).buildList(3)
    const evaluations = withEvaluations ? evaluationFactory.transient({ project }).buildList(3) : []
    const reportsByEvaluationId = withEvaluationReports
      ? evaluations.reduce<Record<string, EvaluationReport[]>>((acc, evaluation) => {
          acc[evaluation.id] = agents.map((agent) =>
            evaluationReportFactory.transient({ evaluation, agent }).build(),
          )
          return acc
        }, {})
      : {}
    const store = buildMockStore({
      state: mergeSeeds(
        seed.me(user),
        seed.organizations([organization], { currentId: organization.id }),
        seed.projects([project], { currentId: project.id }),
        seed.agents(agents),
        seed.studio.evaluations(evaluations),
        seed.studio.evaluationReports(reportsByEvaluationId),
      ),
    })
    return (
      <Provider store={store}>
        <Story />
      </Provider>
    )
  }
}

const meta = {
  title: "routes/studio/evaluation",
  parameters: { layout: "fullscreen" },
  argTypes: {
    role: { control: "select", options: ROLES },
    withEvaluations: { control: "boolean" },
    withEvaluationReports: { control: "boolean" },
  },
  args: {
    role: "owner",
    withEvaluations: false,
    withEvaluationReports: false,
  },
  render: () => {
    const router = createMemoryRouter([studioRoutes], { initialEntries: [projectPath] })
    return <RouterProvider router={router} />
  },
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [buildDecorator()],
}
