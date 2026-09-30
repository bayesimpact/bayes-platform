import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  organizationMembershipFactory,
  projectMembershipFactory,
  reviewCampaignMembershipFactory,
  userFactory,
} from "@/common/features/me/me.factory"
import type { User } from "@/common/features/me/me.models"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import { RouteNames } from "@/common/routes/helpers"
import { onboardingRoute } from "@/common/routes/Router"
import { buildDecorator, render } from "@/stories/decorators"
import { mergeSeeds, seed } from "@/stories/seed"
import { type BaseStoryArgs, baseStoryArgs, baseStoryArgTypes } from "../helpers"

type StoryArgs = BaseStoryArgs & {
  organizationCount: number
  projectsPerOrganization: number
  withReviewCampaignMembershipsAsTester: boolean
  withReviewCampaignMembershipsAsReviewer: boolean
}

function buildData(args: StoryArgs) {
  const {
    organizationCount,
    organizationMembershipRole,
    projectMembershipRole,
    projectsPerOrganization,
    withReviewCampaignMembershipsAsTester,
    withReviewCampaignMembershipsAsReviewer,
    featureFlags,
  } = args
  const organizations = Array.from({ length: organizationCount }, () =>
    organizationFactory.transient({ role: organizationMembershipRole }).build(),
  )
  const fullProjectsByOrganizationId = new Map(
    organizations.map((organization) => [
      organization.id,
      projectFactory
        .transient({ organization })
        .buildList(projectsPerOrganization, { featureFlags }),
    ]),
  )
  const allProjects = [...fullProjectsByOrganizationId.values()].flat()
  const firstProject = allProjects[0]

  const myProjects = allProjects.map((project) => ({
    id: project.id,
    name: project.name,
    organizationId: project.organizationId,
    featureFlags: project.featureFlags,
    permissions: ["project.read"],
  }))

  const organizationMemberships = organizations.map((organization) =>
    organizationMembershipFactory
      .transient({ organization })
      .build({ role: organizationMembershipRole }),
  )
  const projectMemberships = allProjects.map((project) =>
    projectMembershipFactory.transient({ project }).build({ role: projectMembershipRole }),
  )

  const reviewCampaignMemberships =
    (withReviewCampaignMembershipsAsTester || withReviewCampaignMembershipsAsReviewer) &&
    firstProject
      ? [
          ...(withReviewCampaignMembershipsAsTester
            ? [
                reviewCampaignMembershipFactory
                  .transient({ project: firstProject })
                  .build({ role: "tester" }),
              ]
            : []),
          ...(withReviewCampaignMembershipsAsReviewer
            ? [
                reviewCampaignMembershipFactory
                  .transient({ project: firstProject })
                  .build({ role: "reviewer" }),
              ]
            : []),
        ]
      : []
  return {
    organizations,
    myProjects,
    organizationMemberships,
    projectMemberships,
    reviewCampaignMemberships,
  }
}

const meta = {
  title: "routes/Onboarding",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...baseStoryArgTypes,
    organizationCount: { control: { type: "number", min: 0, max: 4 } },
    projectsPerOrganization: { control: { type: "number", min: 0, max: 4 } },
    withReviewCampaignMembershipsAsTester: { control: "boolean" },
    withReviewCampaignMembershipsAsReviewer: { control: "boolean" },
  },
  args: {
    ...baseStoryArgs,
    organizationMembershipRole: "member",
    projectMembershipRole: "member",
    organizationCount: 1,
    projectsPerOrganization: 1,
    withReviewCampaignMembershipsAsTester: false,
    withReviewCampaignMembershipsAsReviewer: false,
  },
  decorators: [
    buildDecorator<StoryArgs>((args) => {
      const data = buildData(args)
      const user: User = userFactory
        .transient({
          organizationMemberships: data.organizationMemberships,
          projectMemberships: data.projectMemberships,
          reviewCampaignMemberships: data.reviewCampaignMemberships,
        })
        .build()

      return {
        state: mergeSeeds(
          seed.me(user),
          seed.organizations(data.organizations),
          seed.myProjects(data.myProjects),
        ),
      }
    }),
  ],
  render: render({
    routes: onboardingRoute,
    path: RouteNames.ONBOARDING,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    projectsPerOrganization: 2,
  },
}

/** Signed in, but nobody gave this person access yet: the no-access page. */
export const Empty: Story = {
  args: {
    organizationMembershipRole: "member",
    projectMembershipRole: "member",
    agentMembershipRole: "owner",
    featureFlags: [],
    organizationCount: 0,
    projectsPerOrganization: 0,
    withReviewCampaignMembershipsAsTester: false,
    withReviewCampaignMembershipsAsReviewer: false,
  },
}

export const Single: Story = {
  args: {
    organizationMembershipRole: "member",
    projectMembershipRole: "member",
    agentMembershipRole: "owner",
    featureFlags: [],
    organizationCount: 1,
    projectsPerOrganization: 1,
    withReviewCampaignMembershipsAsTester: false,
    withReviewCampaignMembershipsAsReviewer: false,
  },
}

export const SingleWithStudioAccess: Story = {
  args: {
    organizationMembershipRole: "member",
    projectMembershipRole: "admin",
    agentMembershipRole: "owner",
    featureFlags: ["evaluation"],
    organizationCount: 1,
    projectsPerOrganization: 1,
    withReviewCampaignMembershipsAsTester: true,
    withReviewCampaignMembershipsAsReviewer: true,
  },
}

export const Multi: Story = {
  args: {
    organizationMembershipRole: "owner",
    projectMembershipRole: "admin",
    agentMembershipRole: "owner",
    featureFlags: [],
    organizationCount: 2,
    projectsPerOrganization: 3,
    withReviewCampaignMembershipsAsTester: true,
    withReviewCampaignMembershipsAsReviewer: true,
  },
}
