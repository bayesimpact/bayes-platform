import type { Meta, StoryObj } from "@storybook/react-vite"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { mcpServerFactory } from "@/studio/features/mcp-servers/mcp-servers.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withServers?: boolean
}

const meta = {
  title: "routes/studio/project/mcp-servers",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withServers: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withServers: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.mcpServers.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ withServers: _withServers, ...args }) => {
      const { baseSeeds } = buildStudioData(args)
      return { state: mergeSeeds(baseSeeds, seed.studio.mcpServers([])) }
    }),
  ],
}

export const WithServers: Story = {
  args: { withServers: true },
  decorators: [
    buildDecorator<StoryArgs>(({ withServers, ...args }) => {
      const { baseSeeds, project } = buildStudioData(args)
      const mcpServers = withServers ? mcpServerFactory.transient({ project }).buildList(3) : []
      return { state: mergeSeeds(baseSeeds, seed.studio.mcpServers(mcpServers)) }
    }),
  ],
}
