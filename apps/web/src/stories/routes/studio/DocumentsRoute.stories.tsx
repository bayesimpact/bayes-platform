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
import { documentTagFactory } from "@/studio/features/document-tags/document-tags.factory"
import { documentFactory } from "@/studio/features/documents/documents.factory"
import { buildStudioPath, StudioRouteNames } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = {
  role: ProjectMembershipRoleDto
  withDocumentTags?: boolean
  withDocuments?: boolean
}

const ROLES: ProjectMembershipRoleDto[] = ["owner", "admin", "member"]

const organization = organizationFactory.build()
const project = projectFactory.transient({ organization }).build()
const projectPath = buildStudioPath(StudioRouteNames.DOCUMENTS)
  .replace(":organizationId", organization.id)
  .replace(":projectId", project.id)

function buildDecorator(): Decorator {
  return (Story, ctx) => {
    const { role, withDocuments, withDocumentTags } = ctx.args as StoryArgs
    const projectMemberships = [projectMembershipFactory.transient({ project }).build({ role })]
    const user = userFactory.transient({ projectMemberships }).build()
    const agents = agentFactory.transient({ project }).buildList(3)
    const documents = withDocuments
      ? [
          documentFactory.transient({ project }).build(),
          documentFactory.transient({ project }).build({ embeddingStatus: "pending" }),
          documentFactory.transient({ project }).build({ embeddingStatus: "processing" }),
          documentFactory
            .transient({ project })
            .build({ embeddingError: "Some error message", embeddingStatus: "failed" }),
        ]
      : []
    const documentTags = withDocumentTags
      ? documentTagFactory.transient({ project }).buildList(3)
      : []
    const store = buildMockStore({
      state: mergeSeeds(
        seed.me(user),
        seed.organizations([organization], { currentId: organization.id }),
        seed.projects([project], { currentId: project.id }),
        seed.agents(agents),
        seed.studio.documents(documents),
        seed.studio.documentTags(documentTags),
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
  title: "routes/studio/documents",
  parameters: { layout: "fullscreen" },
  argTypes: {
    role: { control: "select", options: ROLES },
    withDocuments: { control: "boolean" },
    withDocumentTags: { control: "boolean" },
  },
  args: {
    role: "owner",
    withDocuments: false,
    withDocumentTags: false,
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
