import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import { CreateMcpServerDialog } from "@/studio/features/mcp-servers/components/CreateMcpServerDialog"
import { McpServerToolsDialog } from "@/studio/features/mcp-servers/components/McpServerToolsDialog"
import { UpdateMcpServerDialog } from "@/studio/features/mcp-servers/components/UpdateMcpServerDialog"
import {
  buildCheckedConnection,
  mcpServerFactory,
  mcpServerToolFactory,
} from "@/studio/features/mcp-servers/mcp-servers.factory"

const project = projectFactory.transient({ organization: organizationFactory.build() }).build()

const meta = {
  title: "mcp-servers/dialogs",
  parameters: { layout: "centered" },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  render: () => <CreateMcpServerDialog open onOpenChange={fn()} onSubmit={fn()} />,
}

/** A stored key and two stored headers: none of their values reach the browser. */
export const EditWithApiKeyAndHeaders: Story = {
  render: () => (
    <UpdateMcpServerDialog
      open
      onOpenChange={fn()}
      onSubmit={fn()}
      mcpServer={mcpServerFactory.transient({ project }).build({
        name: "Knowledge Base",
        url: "https://kb.example.com/mcp",
        authMethod: "apiKey",
        authStatus: "apiKey",
        headerNames: ["X-Api-Version", "X-Tenant"],
      })}
    />
  ),
}

/** Changing the URL of an authorized server announces that the authorization goes. */
export const EditAuthorizedOauthServer: Story = {
  render: () => (
    <UpdateMcpServerDialog
      open
      onOpenChange={fn()}
      onSubmit={fn()}
      mcpServer={mcpServerFactory.transient({ project }).build({
        name: "Search Engine",
        url: "https://search.example.com/mcp",
        authMethod: "oauth",
        authStatus: "oauthConnected",
      })}
    />
  ),
}

export const EditServerWithoutAuthentication: Story = {
  render: () => (
    <UpdateMcpServerDialog
      open
      onOpenChange={fn()}
      onSubmit={fn()}
      mcpServer={mcpServerFactory.transient({ project }).build({
        name: "Task Manager",
        url: "https://tasks.example.com/mcp",
      })}
    />
  ),
}

const toolsDialogArgs = {
  serverName: "Knowledge Base",
  authStatus: "apiKey",
  open: true,
  onOpenChange: fn(),
  onRefresh: fn(),
} as const

export const ToolsFew: Story = {
  render: () => (
    <McpServerToolsDialog
      {...toolsDialogArgs}
      connection={buildCheckedConnection({
        tools: [
          ...mcpServerToolFactory.buildList(2),
          { name: "tool_without_description", description: null },
        ],
      })}
    />
  ),
}

/** More tools than fit: the list scrolls inside the dialog. */
export const ToolsMany: Story = {
  render: () => (
    <McpServerToolsDialog
      {...toolsDialogArgs}
      connection={buildCheckedConnection({
        tools: Array.from({ length: 24 }, (_, index) =>
          mcpServerToolFactory.build({ name: `tool_number_${index + 1}` }),
        ),
      })}
    />
  ),
}

const LONG_DESCRIPTION = [
  "Searches the knowledge base and returns the articles that match a question, most relevant first.",
  "Use it when the person asks how to do something, or asks about a rule, a deadline or a contact. Do not use it for a question about their own file: call get_article with the reference instead.",
  "Returns at most ten articles, each with its title, a summary and its reference.",
].join("\n\n")

/** A description longer than two lines is cut, and opens in full on demand. */
export const ToolsLongDescription: Story = {
  render: () => (
    <McpServerToolsDialog
      {...toolsDialogArgs}
      connection={buildCheckedConnection({
        tools: [
          { name: "search_articles", description: LONG_DESCRIPTION },
          { name: "get_article", description: "Returns one article by its reference." },
        ],
      })}
    />
  ),
}

export const ToolsNone: Story = {
  render: () => (
    <McpServerToolsDialog {...toolsDialogArgs} connection={buildCheckedConnection({ tools: [] })} />
  ),
}

/** Opened from the agent editor before any check: the first inspection is in flight. */
export const ToolsChecking: Story = {
  render: () => <McpServerToolsDialog {...toolsDialogArgs} connection={{ state: "checking" }} />,
}

export const ToolsConnectionFailed: Story = {
  render: () => (
    <McpServerToolsDialog
      {...toolsDialogArgs}
      connection={buildCheckedConnection({ status: "failed" })}
    />
  ),
}

export const ToolsAuthorizationExpired: Story = {
  render: () => (
    <McpServerToolsDialog
      {...toolsDialogArgs}
      authStatus="oauthExpired"
      connection={buildCheckedConnection({ status: "authorizationRequired" })}
    />
  ),
}
