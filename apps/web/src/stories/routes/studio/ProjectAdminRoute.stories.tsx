import type { Meta, StoryObj } from "@storybook/react-vite"
import { projectAgentSessionCategoryFactory } from "@/common/features/projects/projects.factory"
import type { ProjectAgentSessionCategory } from "@/common/features/projects/projects.models"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withAgentSessionCategories?: boolean
}

const meta = {
  title: "routes/studio/project/admin",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgentSessionCategories: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgentSessionCategories: false,
  },
  render: render({
    routes: studioRoutes,
    path: StudioRoutes.projectAdmin.path,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ withAgentSessionCategories, ...args }) => {
      const { baseSeeds, project } = buildStudioData(args)
      const categories: ProjectAgentSessionCategory[] = withAgentSessionCategories
        ? [
            projectAgentSessionCategoryFactory.build({ name: "Support" }),
            projectAgentSessionCategoryFactory.build({ name: "Sales" }),
            projectAgentSessionCategoryFactory.build({ name: "Onboarding" }),
          ]
        : []
      const seededProject = { ...project, agentSessionCategories: categories }
      return {
        state: mergeSeeds(
          baseSeeds,
          seed.projects([seededProject], { currentId: seededProject.id }),
        ),
      }
    }),
  ],
}

export const WithCategories: Story = {
  args: {
    ...studioStoryArgs,
    withAgentSessionCategories: true,
  },
  decorators: [
    buildDecorator<StoryArgs>(({ withAgentSessionCategories, ...args }) => {
      const { baseSeeds, project } = buildStudioData(args)
      const categories: ProjectAgentSessionCategory[] = withAgentSessionCategories
        ? [
            projectAgentSessionCategoryFactory.build({ name: "Support" }),
            projectAgentSessionCategoryFactory.build({ name: "Sales" }),
            projectAgentSessionCategoryFactory.build({ name: "Onboarding" }),
          ]
        : []
      const seededProject = { ...project, agentSessionCategories: categories }
      return {
        state: mergeSeeds(
          baseSeeds,
          seed.projects([seededProject], { currentId: seededProject.id }),
        ),
      }
    }),
  ],
}
