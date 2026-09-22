import type { Meta, StoryObj } from "@storybook/react-vite"
import { backofficeRbacCatalogFactory } from "@/backoffice/features/backoffice/backoffice.factory"
import { backofficeRoutes } from "@/backoffice/routes/BackofficeRoutes"
import { BackofficePermissionsRoutes } from "@/backoffice/routes/helpers"
import { buildDecorator, render } from "@/stories/decorators"
import {
  type BackofficeStoryArgs,
  backofficeStoryArgs,
  backofficeStoryArgTypes,
  buildBackofficeData,
  buildMockBackofficeService,
} from "@/stories/routes/backoffice/helpers"
import { mergeSeeds, seed } from "@/stories/seed"

type StoryArgs = BackofficeStoryArgs

const decorator = buildDecorator<StoryArgs>((args) => {
  const { baseSeeds, organizations, users, termsDocuments, appManifests } =
    buildBackofficeData(args)
  const catalog = backofficeRbacCatalogFactory.build()
  return {
    state: mergeSeeds(baseSeeds, seed.backoffice.rbacCatalog(catalog)),
    services: {
      backoffice: buildMockBackofficeService({
        organizations,
        users,
        termsDocuments,
        rbacCatalog: catalog,
        appManifests,
      }),
    },
  }
})

const meta = {
  title: "routes/backoffice/permissions",
  parameters: { layout: "fullscreen" },
  argTypes: backofficeStoryArgTypes,
  args: backofficeStoryArgs,
  decorators: [decorator],
  render: render({
    path: BackofficePermissionsRoutes.permissions.path,
    routes: backofficeRoutes,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Populated: Story = {}
