import type { Meta, StoryObj } from "@storybook/react-vite"
import { fireEvent, userEvent, within } from "storybook/test"
import { backofficeRoutes } from "@/backoffice/routes/BackofficeRoutes"
import { BackofficeAppsRoutes } from "@/backoffice/routes/helpers"
import { buildDecorator, render } from "@/stories/decorators"
import {
  type BackofficeStoryArgs,
  backofficeStoryArgs,
  backofficeStoryArgTypes,
  buildBackofficeData,
  buildMockBackofficeService,
} from "@/stories/routes/backoffice/helpers"

type StoryArgs = BackofficeStoryArgs

const decorator = buildDecorator<StoryArgs>((args) => {
  const { baseSeeds, organizations, users, termsDocuments, appManifests } =
    buildBackofficeData(args)
  return {
    state: baseSeeds,
    services: {
      backoffice: buildMockBackofficeService({
        organizations,
        users,
        termsDocuments,
        appManifests,
      }),
    },
  }
})

const meta = {
  title: "routes/backoffice/apps",
  parameters: { layout: "fullscreen" },
  argTypes: backofficeStoryArgTypes,
  args: {
    ...backofficeStoryArgs,
    isAppManagementAuthorized: true,
    withAppManifests: true,
  },
  decorators: [decorator],
  render: render({
    path: BackofficeAppsRoutes.apps.path,
    routes: backofficeRoutes,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Populated: Story = {}

export const Empty: Story = {
  args: {
    ...backofficeStoryArgs,
    isAppManagementAuthorized: true,
    withAppManifests: false,
  },
}

/** Opens the delete dialog of the first app and returns its element. */
const openFirstDeleteDialog = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  const [deleteButton] = await canvas.findAllByRole("button", { name: /^Delete / })
  if (deleteButton) await userEvent.click(deleteButton)
  return within(canvasElement.ownerDocument.body).findByRole("dialog")
}

/** Delete stays disabled until the app's slug is typed. */
export const DeleteConfirmation: Story = {
  play: async ({ canvasElement }) => {
    await openFirstDeleteDialog(canvasElement)
  },
}

export const DeleteConfirmationWithSlugTyped: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openFirstDeleteDialog(canvasElement)
    // Factory slugs follow a sequence: type the one the dialog asks for.
    const slug = dialog.querySelector("code")?.textContent ?? ""
    // fireEvent sets the value as React expects, even when the page has no focus.
    fireEvent.change(within(dialog).getByLabelText(/to confirm/), { target: { value: slug } })
  },
}
