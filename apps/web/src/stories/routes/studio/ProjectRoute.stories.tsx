import type { ProjectMembershipRoleDto } from "@caseai-connect/api-contracts"
import { type FeatureFlagKey, FeatureFlags } from "@caseai-connect/api-contracts"
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite"
import { Provider } from "react-redux"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { projectMembershipFactory, userFactory } from "@/common/features/me/me.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import type { Project } from "@/common/features/projects/projects.models"
import { RouteNames } from "@/common/routes/helpers"
import { buildMockStore } from "@/stories/decorators/with-redux"
import { sortRecentlyCreated } from "@/stories/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { buildStudioPath } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = {
  role: ProjectMembershipRoleDto
  featureFlags?: Project["featureFlags"]
  withAgents?: boolean
}

const ROLES: ProjectMembershipRoleDto[] = ["owner", "admin", "member"]

const organization = organizationFactory.build()
const project = projectFactory.transient({ organization }).build()

const agents = agentFactory.transient({ project }).buildList(3).sort(sortRecentlyCreated)

const projectPath = buildStudioPath(RouteNames.PROJECT)
  .replace(":organizationId", organization.id)
  .replace(":projectId", project.id)

function buildRoleControlledDecorator(): Decorator {
  return (Story, ctx) => {
    const { role, withAgents, featureFlags = [] } = ctx.args as StoryArgs
    const projectMemberships = [projectMembershipFactory.transient({ project }).build({ role })]
    const user = userFactory.transient({ projectMemberships }).build()
    const store = buildMockStore({
      state: mergeSeeds(
        seed.me(user),
        seed.organizations([organization], { currentId: organization.id }),
        seed.projects([{ ...project, featureFlags }], { currentId: project.id }),
        seed.agents(withAgents ? agents : []),
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
  title: "routes/studio/project",
  parameters: { layout: "fullscreen" },
  argTypes: {
    role: { control: "select", options: ROLES },
    withAgents: { control: "boolean" },
    featureFlags: {
      control: "inline-check",
      options: Object.values(FeatureFlags.map((flag) => flag.key)) as FeatureFlagKey[],
    },
  },
  args: {
    role: "owner",
    withAgents: false,
    featureFlags: [],
  },
  render: () => {
    const router = createMemoryRouter([studioRoutes], { initialEntries: [projectPath] })
    return <RouterProvider router={router} />
  },
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [buildRoleControlledDecorator()],
}
