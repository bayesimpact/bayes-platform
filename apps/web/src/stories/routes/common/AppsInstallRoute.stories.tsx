import type { Meta, StoryObj } from "@storybook/react-vite"
import { Provider } from "react-redux"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { appInstallPageFactory } from "@/common/features/app-install/app-install.factory"
import { userFactory } from "@/common/features/me/me.factory"
import { appsInstallRoute } from "@/common/routes/Router"
import { buildMockStore } from "@/stories/decorators"
import { mergeSeeds, seed } from "@/stories/seed"

const page = appInstallPageFactory.build({
  app: { name: "Helpful Assistant", slug: "helpful-assistant" },
})

const loopbackEntry =
  "/apps/install/helpful-assistant?redirect_uri=http%3A%2F%2F127.0.0.1%3A8787%2Fcallback&state=csrf-state"

function renderAt(initialEntry: string, withPage: boolean) {
  return () => {
    const store = buildMockStore({
      state: mergeSeeds(
        seed.me(userFactory.build({ globalPermissions: ["app.install"], termsAccepted: true })),
        withPage ? seed.appInstallPage(page) : {},
      ),
    })
    const router = createMemoryRouter([appsInstallRoute], {
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
  title: "routes/common/apps-install",
  parameters: { layout: "fullscreen" },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {
  render: renderAt(loopbackEntry, true),
}

export const InvalidRedirect: Story = {
  render: renderAt("/apps/install/helpful-assistant", false),
}

export const EmptyWorkspaces: Story = {
  render: () => {
    const emptyPage = appInstallPageFactory.build({ projects: [] })
    const store = buildMockStore({
      state: mergeSeeds(
        seed.me(userFactory.build({ globalPermissions: ["app.install"], termsAccepted: true })),
        seed.appInstallPage(emptyPage),
      ),
    })
    const router = createMemoryRouter([appsInstallRoute], {
      initialEntries: [loopbackEntry],
    })
    return (
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    )
  },
}
