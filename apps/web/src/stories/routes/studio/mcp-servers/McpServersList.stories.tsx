import type { Meta, StoryObj } from "@storybook/react-vite"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import {
  buildPdfExportMcpServer,
  mcpServerFactory,
} from "@/studio/features/mcp-servers/mcp-servers.factory"
import type { IMcpServersSpi } from "@/studio/features/mcp-servers/mcp-servers.spi"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withBuiltIn?: boolean
  withServers?: boolean
}

function buildMockMcpServersService(
  overrides: { mcpServers?: ReturnType<typeof mcpServerFactory.build>[] } = {},
): IMcpServersSpi {
  const mcpServers = overrides.mcpServers ?? []
  return {
    async getAll() {
      return mcpServers
    },
    async createOne(_, payload) {
      return mcpServerFactory.transient({ project: { id: "mock" } as never }).build(payload)
    },
    async deleteOne() {},
    async enableForAgent() {},
    async disableForAgent() {},
  }
}

const meta = {
  title: "routes/studio/project/mcp-servers",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withBuiltIn: { control: "boolean" },
    withServers: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    featureFlags: [...studioStoryArgs.featureFlags, "agent-mcp"],
    withBuiltIn: true,
    withServers: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.mcpServers.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: { withBuiltIn: false, withServers: false },
  decorators: [
    buildDecorator<StoryArgs>(
      ({ withBuiltIn: _withBuiltIn, withServers: _withServers, ...args }) => {
        const { baseSeeds } = buildStudioData(args)
        return {
          state: mergeSeeds(baseSeeds, seed.studio.mcpServers([])),
          services: { mcpServers: buildMockMcpServersService({ mcpServers: [] }) },
        }
      },
    ),
  ],
}

export const BuiltInOnly: Story = {
  args: { withBuiltIn: true, withServers: false },
  decorators: [
    buildDecorator<StoryArgs>(({ withBuiltIn, withServers, ...args }) => {
      const { baseSeeds, project } = buildStudioData(args)
      const mcpServers = [
        ...(withBuiltIn ? [buildPdfExportMcpServer(project)] : []),
        ...(withServers ? mcpServerFactory.transient({ project }).buildList(3) : []),
      ]
      return {
        state: mergeSeeds(baseSeeds, seed.studio.mcpServers(mcpServers)),
        services: { mcpServers: buildMockMcpServersService({ mcpServers }) },
      }
    }),
  ],
}

export const WithServers: Story = {
  args: { withBuiltIn: true, withServers: true },
  decorators: [
    buildDecorator<StoryArgs>(({ withBuiltIn, withServers, ...args }) => {
      const { baseSeeds, project } = buildStudioData(args)
      const mcpServers = [
        ...(withBuiltIn ? [buildPdfExportMcpServer(project)] : []),
        ...(withServers ? mcpServerFactory.transient({ project }).buildList(3) : []),
      ]
      return {
        state: mergeSeeds(baseSeeds, seed.studio.mcpServers(mcpServers)),
        services: { mcpServers: buildMockMcpServersService({ mcpServers }) },
      }
    }),
  ],
}
