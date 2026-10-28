import type { Meta, StoryObj } from "@storybook/react-vite"
import { backofficeRoutes } from "@/backoffice/routes/BackofficeRoutes"
import { BackofficeUserRoutes } from "@/backoffice/routes/helpers"
import { buildDecorator, render } from "@/stories/decorators"
import {
  BACKOFFICE_STORY_USER_ID,
  type BackofficeStoryArgs,
  backofficeStoryArgs,
  backofficeStoryArgTypes,
  buildBackofficeData,
  buildInspectorUserDetail,
  buildMockBackofficeService,
} from "@/stories/routes/backoffice/helpers"
import { mergeSeeds, seed } from "@/stories/seed"

type StoryArgs = BackofficeStoryArgs & { withGlobalRoles: boolean }

const decorator = buildDecorator<StoryArgs>((args) => {
  const { baseSeeds, organizations, users, termsDocuments, appManifests } =
    buildBackofficeData(args)
  const inspectorUserDetail = buildInspectorUserDetail()
  const userDetail = args.withGlobalRoles
    ? inspectorUserDetail
    : { ...inspectorUserDetail, globalRoles: [] }
  return {
    state: mergeSeeds(baseSeeds, seed.backoffice.userDetail(userDetail)),
    services: {
      backoffice: buildMockBackofficeService({
        organizations,
        users,
        termsDocuments,
        appManifests,
        userDetails: { [userDetail.id]: userDetail },
      }),
    },
  }
})

const meta = {
  title: "routes/backoffice/users/detail",
  parameters: { layout: "fullscreen" },
  argTypes: { ...backofficeStoryArgTypes, withGlobalRoles: { control: "boolean" } },
  args: { ...backofficeStoryArgs, withGlobalRoles: true },
  decorators: [decorator],
  render: render({
    path: BackofficeUserRoutes.user.build({ userId: BACKOFFICE_STORY_USER_ID }),
    routes: backofficeRoutes,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Populated: Story = {}

/** A superadmin looks at someone with no global role yet: only the grant control shows. */
export const NoGlobalRole: Story = { args: { withGlobalRoles: false } }

/** Someone who can open the backoffice but not change global roles: read-only badges. */
export const ReadOnlyGlobalRoles: Story = { args: { canUpdateGlobalRoles: false } }
