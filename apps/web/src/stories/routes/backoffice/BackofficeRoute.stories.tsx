import type { Meta, StoryObj } from "@storybook/react-vite"
import { backofficeRoutes } from "@/backoffice/routes/BackofficeRoutes"
import { BackofficeRoutes } from "@/backoffice/routes/helpers"
import { userFactory } from "@/common/features/me/me.factory"
import { buildDecorator, render } from "@/stories/decorators"
import {
  type BackofficeStoryArgs,
  backofficeStoryArgs,
  backofficeStoryArgTypes,
  buildBackofficeData,
  buildMockBackofficeService,
} from "@/stories/routes/backoffice/helpers"
import { mergeSeeds, seed } from "@/stories/seed"

const meta = {
  title: "routes/backoffice",
  parameters: { layout: "fullscreen" },
  argTypes: backofficeStoryArgTypes,
  args: backofficeStoryArgs,
  render: render({ path: BackofficeRoutes.home.path, routes: backofficeRoutes }),
} satisfies Meta<BackofficeStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Populated: Story = {
  decorators: [
    buildDecorator<BackofficeStoryArgs>((args) => {
      const { baseSeeds, organizations, users, termsDocuments } = buildBackofficeData(args)
      return {
        state: baseSeeds,
        services: {
          backoffice: buildMockBackofficeService({ organizations, users, termsDocuments }),
        },
      }
    }),
  ],
}

export const Empty: Story = {
  args: {
    ...backofficeStoryArgs,
    withOrganizations: false,
    withUsers: false,
  },
  decorators: [
    buildDecorator<BackofficeStoryArgs>((args) => {
      const { baseSeeds, organizations, users, termsDocuments } = buildBackofficeData(args)
      return {
        state: baseSeeds,
        services: {
          backoffice: buildMockBackofficeService({ organizations, users, termsDocuments }),
        },
      }
    }),
  ],
}

export const WithTermsManagement: Story = {
  args: {
    ...backofficeStoryArgs,
    isTermsManagementAuthorized: true,
    withTermsDocuments: true,
  },
  decorators: [
    buildDecorator<BackofficeStoryArgs>((args) => {
      const { baseSeeds, organizations, users, termsDocuments } = buildBackofficeData(args)
      return {
        state: baseSeeds,
        services: {
          backoffice: buildMockBackofficeService({ organizations, users, termsDocuments }),
        },
      }
    }),
  ],
}

export const Unauthorized: Story = {
  args: {
    ...backofficeStoryArgs,
    isBackofficeAuthorized: false,
  },
  decorators: [
    buildDecorator<BackofficeStoryArgs>((args) => ({
      state: mergeSeeds(
        seed.me(
          userFactory.build({
            isBackofficeAuthorized: args.isBackofficeAuthorized,
            isTermsManagementAuthorized: args.isTermsManagementAuthorized,
          }),
        ),
      ),
      services: {
        backoffice: buildMockBackofficeService({}),
      },
    })),
  ],
}
