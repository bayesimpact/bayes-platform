import type { Meta, StoryObj } from "@storybook/react-vite"
import { Provider } from "react-redux"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { mcpOauthCallbackRoute } from "@/common/routes/Router"
import { buildMockStore } from "@/stories/decorators"

function renderAt(initialEntry: string) {
  return () => {
    const store = buildMockStore()
    const router = createMemoryRouter([mcpOauthCallbackRoute], {
      initialEntries: [initialEntry],
    })
    return (
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    )
  }
}

const meta = {
  title: "routes/common/mcp-oauth-callback",
  parameters: { layout: "fullscreen" },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const ProviderDenied: Story = {
  render: renderAt("/oauth/mcp/callback?error=access_denied"),
}

export const MissingContext: Story = {
  render: renderAt("/oauth/mcp/callback"),
}
