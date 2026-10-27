import {
  BACKOFFICE_PROJECT_READ_PERMISSION,
  BACKOFFICE_PROJECT_UPDATE_PERMISSION,
} from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
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

type UpdatableProjects = "all" | "some" | "none"

type StoryArgs = BackofficeStoryArgs & { updatableProjects?: UpdatableProjects }

// every other project when "some": a platform_staff caller who is admin of some projects only
const canUpdate = (updatableProjects: UpdatableProjects, projectIndex: number) =>
  updatableProjects === "all" || (updatableProjects === "some" && projectIndex % 2 === 0)

// The panel lists projects again on mount: the mock service returns the seeded page.
const decorator = buildDecorator<StoryArgs>(({ updatableProjects = "all", ...args }) => {
  const { baseSeeds, projects: seededProjects } = buildBackofficeData(args)
  const projects = {
    ...seededProjects,
    projects: seededProjects.projects.map((project, projectIndex) => ({
      ...project,
      featureFlags: projectIndex % 3 === 0 ? ["gemma" as const] : project.featureFlags,
      permissions: canUpdate(updatableProjects, projectIndex)
        ? [BACKOFFICE_PROJECT_READ_PERMISSION, BACKOFFICE_PROJECT_UPDATE_PERMISSION]
        : [BACKOFFICE_PROJECT_READ_PERMISSION],
    })),
  }
  return {
    state: mergeSeeds(baseSeeds, seed.backoffice.projects(projects)),
    services: { backoffice: buildMockBackofficeService({ projects }) },
  }
})

const meta = {
  title: "routes/backoffice/projects/list",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...backofficeStoryArgTypes,
    updatableProjects: { control: "inline-radio", options: ["all", "some", "none"] },
  },
  args: { ...backofficeStoryArgs, updatableProjects: "all" },
  decorators: [decorator],
  render: render({
    path: BackofficeProjectRoutes.projects.path,
    routes: backofficeRoutes,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Populated: Story = {}

export const SomeProjectsReadOnly: Story = {
  args: { updatableProjects: "some" },
}

export const AllProjectsReadOnly: Story = {
  args: { updatableProjects: "none" },
}

export const Empty: Story = {
  args: { ...backofficeStoryArgs, withProjects: false },
}
