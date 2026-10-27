import {
  BACKOFFICE_AGENT_READ_PERMISSION,
  BACKOFFICE_ORGANIZATION_READ_PERMISSION,
  BACKOFFICE_PROJECT_READ_PERMISSION,
  BACKOFFICE_PROJECT_UPDATE_PERMISSION,
} from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  backofficeProjectAgentFactory,
  backofficeProjectDetailFactory,
  backofficeProjectMemberFactory,
} from "@/backoffice/features/backoffice/backoffice.factory"
import { backofficeRoutes } from "@/backoffice/routes/BackofficeRoutes"
import { BackofficeProjectRoutes } from "@/backoffice/routes/helpers"
import { buildDecorator, render } from "@/stories/decorators"
import {
  type BackofficeStoryArgs,
  backofficeStoryArgs,
  backofficeStoryArgTypes,
  buildBackofficeData,
  buildMockBackofficeService,
} from "@/stories/routes/backoffice/helpers"
import { mergeSeeds, seed } from "@/stories/seed"

const BACKOFFICE_STORY_PROJECT_ID = "9a1e5c3b-2d4f-4b6a-8c7d-0e1f2a3b4c5d"

type StoryArgs = BackofficeStoryArgs & {
  canReadOrganization?: boolean
  canReadAgents?: boolean
  canReadMembers?: boolean
  canUpdateProject?: boolean
}

const decorator = buildDecorator<StoryArgs>(
  ({ canReadOrganization, canReadAgents, canReadMembers, canUpdateProject, ...args }) => {
    const { baseSeeds, organizations, users } = buildBackofficeData(args)
    const projectDetail = backofficeProjectDetailFactory.build({
      id: BACKOFFICE_STORY_PROJECT_ID,
      featureFlags: ["gemma"],
      permissions: canUpdateProject
        ? [BACKOFFICE_PROJECT_READ_PERMISSION, BACKOFFICE_PROJECT_UPDATE_PERMISSION]
        : [BACKOFFICE_PROJECT_READ_PERMISSION],
      organization: {
        name: "Acme Corp",
        permissions: canReadOrganization ? [BACKOFFICE_ORGANIZATION_READ_PERMISSION] : [],
      },
      members: backofficeProjectMemberFactory.buildList(2, { canRead: canReadMembers }),
      agents: ["Helpful Assistant", "Support Agent"].map((name) =>
        backofficeProjectAgentFactory.build({
          name,
          permissions: canReadAgents ? [BACKOFFICE_AGENT_READ_PERMISSION] : [],
        }),
      ),
    })
    return {
      state: mergeSeeds(baseSeeds, seed.backoffice.projectDetail(projectDetail)),
      services: {
        backoffice: buildMockBackofficeService({
          organizations,
          users,
          projectDetails: { [projectDetail.id]: projectDetail },
        }),
      },
    }
  },
)

const meta = {
  title: "routes/backoffice/projects/detail",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...backofficeStoryArgTypes,
    canReadOrganization: { control: "boolean" },
    canReadAgents: { control: "boolean" },
    canReadMembers: { control: "boolean" },
    canUpdateProject: { control: "boolean" },
  },
  args: {
    ...backofficeStoryArgs,
    canReadOrganization: true,
    canReadAgents: true,
    canReadMembers: true,
    canUpdateProject: true,
  },
  decorators: [decorator],
  render: render({
    path: BackofficeProjectRoutes.project.build({ projectId: BACKOFFICE_STORY_PROJECT_ID }),
    routes: backofficeRoutes,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutOrganizationAccess: Story = {
  args: { canReadOrganization: false },
}

export const WithoutOrganizationAndAgentAccess: Story = {
  args: { canReadOrganization: false, canReadAgents: false },
}

export const WithoutMemberAccess: Story = {
  args: { canReadMembers: false },
}

export const WithoutProjectUpdate: Story = {
  args: { canUpdateProject: false },
}

export const ProjectAccessOnly: Story = {
  args: {
    canReadOrganization: false,
    canReadAgents: false,
    canReadMembers: false,
    canUpdateProject: false,
  },
}
