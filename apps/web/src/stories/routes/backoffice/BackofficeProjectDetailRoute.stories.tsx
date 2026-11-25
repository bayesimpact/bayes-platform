import {
  AgentModel,
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
  buildCustomModelTypes,
  customModelFactory,
  projectModelFactory,
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
  /** Members the caller may read as users. */
  visibleMembers?: number
  /** Members the caller may not read, which the API leaves out and only counts. */
  hiddenMembers?: number
  canUpdateProject?: boolean
  /** Some models turned on and added in the workspace, shown to superadmins. */
  withWorkspaceModels?: boolean
}

const decorator = buildDecorator<StoryArgs>(
  ({
    canReadOrganization,
    canReadAgents,
    visibleMembers,
    hiddenMembers,
    canUpdateProject,
    withWorkspaceModels,
    ...args
  }) => {
    const { baseSeeds, organizations, users } = buildBackofficeData(args)
    const projectDetail = backofficeProjectDetailFactory.build({
      id: BACKOFFICE_STORY_PROJECT_ID,
      featureFlags: ["agent-memory"],
      permissions: canUpdateProject
        ? [BACKOFFICE_PROJECT_READ_PERMISSION, BACKOFFICE_PROJECT_UPDATE_PERMISSION]
        : [BACKOFFICE_PROJECT_READ_PERMISSION],
      organization: {
        name: "Acme Corp",
        permissions: canReadOrganization ? [BACKOFFICE_ORGANIZATION_READ_PERMISSION] : [],
      },
      members: backofficeProjectMemberFactory.buildList(visibleMembers ?? 0),
      hiddenMemberCount: hiddenMembers ?? 0,
      agents: ["Helpful Assistant", "Support Agent"].map((name) =>
        backofficeProjectAgentFactory.build({
          name,
          permissions: canReadAgents ? [BACKOFFICE_AGENT_READ_PERMISSION] : [],
        }),
      ),
    })
    const projectModels = [
      projectModelFactory.build({ model: AgentModel.Gemini35Flash }),
      projectModelFactory.build({ model: AgentModel.Gemini4Argon }),
      projectModelFactory.build(
        withWorkspaceModels
          ? { model: AgentModel.Gemma4_26B, enabled: true, customized: true }
          : { model: AgentModel.Gemma4_26B },
      ),
      projectModelFactory.build({ model: AgentModel.Qwen38_27B }),
    ]
    const customModels = {
      customModels: withWorkspaceModels
        ? [
            customModelFactory.build({
              name: "Gemma 4 on the new server",
              baseModel: AgentModel.Gemma4_26B,
              agentCount: 2,
            }),
          ]
        : [],
      types: buildCustomModelTypes(),
    }
    return {
      state: mergeSeeds(
        baseSeeds,
        seed.backoffice.projectDetail(projectDetail),
        seed.backoffice.projectModels(projectModels),
        seed.backoffice.customModels(customModels),
      ),
      services: {
        backoffice: buildMockBackofficeService({
          organizations,
          users,
          projectDetails: { [projectDetail.id]: projectDetail },
          projectModels,
          customModels,
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
    visibleMembers: { control: { type: "number", min: 0 } },
    hiddenMembers: { control: { type: "number", min: 0 } },
    canUpdateProject: { control: "boolean" },
    withWorkspaceModels: { control: "boolean" },
  },
  args: {
    ...backofficeStoryArgs,
    canReadOrganization: true,
    canReadAgents: true,
    visibleMembers: 2,
    hiddenMembers: 0,
    canUpdateProject: true,
    isWorkspaceModelManagementAuthorized: true,
    withWorkspaceModels: true,
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
  args: { visibleMembers: 0, hiddenMembers: 3 },
}

export const SomeMembersHidden: Story = {
  args: { visibleMembers: 1, hiddenMembers: 2 },
}

export const OneMemberHidden: Story = {
  args: { visibleMembers: 2, hiddenMembers: 1 },
}

export const WithoutMembers: Story = {
  args: { visibleMembers: 0, hiddenMembers: 0 },
}

/** A superadmin sees the models of the workspace; without the permission, the section is hidden. */
export const WithoutModelManagement: Story = {
  args: { isWorkspaceModelManagementAuthorized: false },
}

export const WithoutProjectUpdate: Story = {
  args: { canUpdateProject: false },
}

export const ProjectAccessOnly: Story = {
  args: {
    canReadOrganization: false,
    canReadAgents: false,
    visibleMembers: 0,
    hiddenMembers: 3,
    canUpdateProject: false,
  },
}
