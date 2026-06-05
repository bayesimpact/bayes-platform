import type { Meta, StoryObj } from "@storybook/react-vite"
import { projectAgentCategoryFactory } from "@/common/features/projects/projects.factory"
import type { ProjectAgentCategory } from "@/common/features/projects/projects.models"
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
  withAgentCategories?: boolean
}

const meta = {
  title: "routes/studio/project/admin",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgentCategories: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgentCategories: false,
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
    buildDecorator<StoryArgs>(({ withAgentCategories, ...args }) => {
      const { baseSeeds, project } = buildStudioData(args)
      const categories: ProjectAgentCategory[] = withAgentCategories
        ? [
            projectAgentCategoryFactory.build({ name: "Support" }),
            projectAgentCategoryFactory.build({ name: "Sales" }),
            projectAgentCategoryFactory.build({ name: "Onboarding" }),
          ]
        : []
      const seededProject = { ...project, agentCategories: categories }
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
    withAgentCategories: true,
  },
  decorators: [
    buildDecorator<StoryArgs>(({ withAgentCategories, ...args }) => {
      const { baseSeeds, project } = buildStudioData(args)
      const categories: ProjectAgentCategory[] = withAgentCategories
        ? [
            projectAgentCategoryFactory.build({ name: "Support" }),
            projectAgentCategoryFactory.build({ name: "Sales" }),
            projectAgentCategoryFactory.build({ name: "Onboarding" }),
          ]
        : []
      const seededProject = { ...project, agentCategories: categories }
      return {
        state: mergeSeeds(
          baseSeeds,
          seed.projects([seededProject], { currentId: seededProject.id }),
        ),
      }
    }),
  ],
}
