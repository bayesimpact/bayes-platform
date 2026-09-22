import type { Meta, StoryObj } from "@storybook/react-vite"
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
