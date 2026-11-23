import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Project } from "@/common/features/projects/projects.models"
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
  mcpServerInspectionFactory,
  mcpServerToolFactory,
} from "@/studio/features/mcp-servers/mcp-servers.factory"
import type {
  McpServer,
  McpServerInspection,
} from "@/studio/features/mcp-servers/mcp-servers.models"
import type { IMcpServersSpi } from "@/studio/features/mcp-servers/mcp-servers.spi"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withBuiltIn?: boolean
  withServers?: boolean
}

function buildMockMcpServersService(
  overrides: { mcpServers?: McpServer[]; inspections?: Record<string, McpServerInspection> } = {},
): IMcpServersSpi {
  const mcpServers = overrides.mcpServers ?? []
  const inspections = overrides.inspections ?? {}
  const fallbackServer = () =>
    mcpServers[0] ?? mcpServerFactory.transient({ project: { id: "mock" } as never }).build()
  return {
    async getAll() {
      return mcpServers
    },
    async createOne(_, payload) {
      return mcpServerFactory.transient({ project: { id: "mock" } as never }).build({
        name: payload.name,
        url: payload.url,
        authMethod: payload.authMethod,
        headerNames: Object.keys(payload.headers ?? {}),
      })
    },
    async updateOne({ mcpServerId }, payload) {
      const mcpServer = mcpServers.find((server) => server.id === mcpServerId) ?? fallbackServer()
      return {
        ...mcpServer,
        name: payload.name ?? mcpServer.name,
        url: payload.url ?? mcpServer.url,
        authMethod: payload.authMethod ?? mcpServer.authMethod,
        headerNames: payload.headers ? Object.keys(payload.headers) : mcpServer.headerNames,
      }
    },
    async deleteOne() {},
    // The "Test the connection" button of a story answers what the story seeded.
    async inspect({ mcpServerId }) {
      return inspections[mcpServerId] ?? mcpServerInspectionFactory.build()
    },
    async enableForAgent() {},
    async disableForAgent() {},
    async initiateOauth() {
      return { authorizationUrl: "https://example.com/oauth/authorize" }
    },
    async completeOauth() {
      return fallbackServer()
    },
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

/** Every server answered: the state the page is in most of the time. */
function buildConnectedServers({
  project,
  withBuiltIn,
  withServers,
}: {
  project: Project
  withBuiltIn?: boolean
  withServers?: boolean
}) {
  const mcpServers = [
    ...(withBuiltIn ? [buildPdfExportMcpServer(project)] : []),
    ...(withServers ? mcpServerFactory.transient({ project }).buildList(3) : []),
  ]
  const inspections = Object.fromEntries(
    mcpServers.map((mcpServer, index) => [
      mcpServer.id,
      mcpServerInspectionFactory.build({ tools: mcpServerToolFactory.buildList(index + 1) }),
    ]),
  )
  return { mcpServers, inspections }
}

export const BuiltInOnly: Story = {
  args: { withBuiltIn: true, withServers: false },
  decorators: [
    buildDecorator<StoryArgs>(({ withBuiltIn, withServers, ...args }) => {
      const { baseSeeds, project } = buildStudioData(args)
      const { mcpServers, inspections } = buildConnectedServers({
        project,
        withBuiltIn,
        withServers,
      })
      return {
        state: mergeSeeds(
          baseSeeds,
          seed.studio.mcpServers(mcpServers),
          seed.studio.mcpServerInspections({ inspections }),
        ),
        services: { mcpServers: buildMockMcpServersService({ mcpServers, inspections }) },
      }
    }),
  ],
}

export const WithServers: Story = {
  args: { withBuiltIn: true, withServers: true },
  decorators: [
    buildDecorator<StoryArgs>(({ withBuiltIn, withServers, ...args }) => {
      const { baseSeeds, project } = buildStudioData(args)
      const { mcpServers, inspections } = buildConnectedServers({
        project,
        withBuiltIn,
        withServers,
      })
      return {
        state: mergeSeeds(
          baseSeeds,
          seed.studio.mcpServers(mcpServers),
          seed.studio.mcpServerInspections({ inspections }),
        ),
        services: { mcpServers: buildMockMcpServersService({ mcpServers, inspections }) },
      }
    }),
  ],
}

/** The page just opened: the list is there, every connection is still being checked. */
export const CheckingConnections: Story = {
  args: { withBuiltIn: true, withServers: true },
  decorators: [
    buildDecorator<StoryArgs>(({ withBuiltIn, withServers, ...args }) => {
      const { baseSeeds, project } = buildStudioData(args)
      const { mcpServers } = buildConnectedServers({ project, withBuiltIn, withServers })
      return {
        state: mergeSeeds(
          baseSeeds,
          seed.studio.mcpServers(mcpServers),
          seed.studio.mcpServerInspections({
            inspectingIds: mcpServers.map((mcpServer) => mcpServer.id),
          }),
        ),
        services: { mcpServers: buildMockMcpServersService({ mcpServers }) },
      }
    }),
  ],
}

/** One card per state a server can be in, so each can be compared with the others. */
export const ConnectionStates: Story = {
  args: { withServers: true },
  decorators: [
    buildDecorator<StoryArgs>(({ withServers: _withServers, ...args }) => {
      const { baseSeeds, project } = buildStudioData(args)
      const build = (params: Partial<McpServer>) =>
        mcpServerFactory.transient({ project }).build(params)

      const connected = build({
        name: "Knowledge Base",
        url: "https://kb.example.com/mcp",
        authMethod: "apiKey",
        authStatus: "apiKey",
        headerNames: ["X-Api-Version"],
      })
      const noTools = build({ name: "Empty Server", url: "https://empty.example.com/mcp" })
      const refreshing = build({
        name: "Search Engine",
        url: "https://search.example.com/mcp",
        authMethod: "oauth",
        authStatus: "oauthConnected",
      })
      const checking = build({ name: "Calendar Service", url: "https://calendar.example.com/mcp" })
      const unauthorized = build({
        name: "CRM Integration",
        url: "https://crm.example.com/mcp",
        authMethod: "apiKey",
        authStatus: "apiKey",
      })
      const unreachable = build({ name: "Task Manager", url: "https://tasks.exemple.invalid/mcp" })
      const notMcp = build({ name: "Company Website", url: "https://www.example.com" })
      const longError = build({
        name: "A server with a long name that has to be cut somewhere",
        url: "https://a-rather-long-host-name.example.com/some/deep/path/to/the/mcp/endpoint",
      })
      const oauthPending = build({
        name: "Document Store",
        url: "https://docs.example.com/mcp",
        authMethod: "oauth",
        authStatus: "oauthPending",
      })
      const oauthExpired = build({
        name: "Mail Service",
        url: "https://mail.example.com/mcp",
        authMethod: "oauth",
        authStatus: "oauthExpired",
      })

      const mcpServers = [
        buildPdfExportMcpServer(project),
        connected,
        noTools,
        refreshing,
        checking,
        unauthorized,
        unreachable,
        notMcp,
        longError,
        oauthPending,
        oauthExpired,
      ]
      const failed = (error: NonNullable<McpServerInspection["error"]>) =>
        mcpServerInspectionFactory.build({ status: "failed", error })
      const inspections: Record<string, McpServerInspection> = {
        "built-in-pdf-export": mcpServerInspectionFactory.build({
          tools: [{ name: "export_pdf", description: "Renders a document as a PDF file." }],
        }),
        [connected.id]: mcpServerInspectionFactory.build({
          tools: mcpServerToolFactory.buildList(5),
        }),
        [noTools.id]: mcpServerInspectionFactory.build({ tools: [] }),
        [refreshing.id]: mcpServerInspectionFactory.build({
          tools: mcpServerToolFactory.buildList(12),
        }),
        [unauthorized.id]: failed({
          code: "unauthorized",
          httpStatus: 401,
          detail:
            'MCP HTTP Transport Error: POSTing to endpoint (HTTP 401): {"error":"invalid_token"}',
        }),
        [unreachable.id]: failed({
          code: "unreachable",
          httpStatus: null,
          detail: "Host tasks.exemple.invalid could not be resolved",
        }),
        [notMcp.id]: failed({
          code: "notMcp",
          httpStatus: null,
          detail: "MCP HTTP Transport Error: Unexpected content type: text/html; charset=utf-8",
        }),
        [longError.id]: failed({
          code: "httpError",
          httpStatus: 502,
          detail: `MCP HTTP Transport Error: POSTing to endpoint (HTTP 502): ${"<html><head><title>502 Bad Gateway</title></head> ".repeat(5)}…`,
        }),
        [oauthPending.id]: mcpServerInspectionFactory.build({ status: "authorizationRequired" }),
        [oauthExpired.id]: mcpServerInspectionFactory.build({ status: "authorizationRequired" }),
      }
      return {
        state: mergeSeeds(
          baseSeeds,
          seed.studio.mcpServers(mcpServers),
          seed.studio.mcpServerInspections({
            inspections,
            inspectingIds: [refreshing.id, checking.id],
          }),
        ),
        services: { mcpServers: buildMockMcpServersService({ mcpServers, inspections }) },
      }
    }),
  ],
}
