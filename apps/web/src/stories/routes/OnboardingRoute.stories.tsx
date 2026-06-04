import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
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
import { pendingInvitationFactory } from "@/studio/features/invitations/invitations.factory"
import { type BaseStoryArgs, baseStoryArgs, baseStoryArgTypes } from "../helpers"

type StoryArgs = BaseStoryArgs & {
  organizationCount: number
  projectsPerOrganization: number
  withProjectInvitations: boolean
  withAgentInvitations: boolean
  withReviewCampaignMembershipsAsTester: boolean
  withReviewCampaignMembershipsAsReviewer: boolean
}

function buildData(args: StoryArgs) {
  const {
    organizationCount,
    organizationMembershipRole,
    projectMembershipRole,
    projectsPerOrganization,
    withProjectInvitations,
    withAgentInvitations,
    withReviewCampaignMembershipsAsTester,
    withReviewCampaignMembershipsAsReviewer,
    featureFlags,
  } = args
  const organizations = Array.from({ length: organizationCount }, () => organizationFactory.build())
  const organizationsWithProjects = organizations.map((organization) => {
    const projects = projectFactory
      .transient({ organization })
      .buildList(projectsPerOrganization, { featureFlags })
    return { ...organization, projects }
  })

  const allProjects = organizationsWithProjects.flatMap((organization) => organization.projects)
  const firstProject = allProjects[0]

  const organizationMemberships = organizationsWithProjects.map((organization) =>
    organizationMembershipFactory
      .transient({ organization })
      .build({ role: organizationMembershipRole }),
  )
  const projectMemberships = allProjects.map((project) =>
    projectMembershipFactory.transient({ project }).build({ role: projectMembershipRole }),
  )

  const projectInvitations = withProjectInvitations
    ? [
        pendingInvitationFactory
          .transient({
            project: projectFactory
              .transient({ organization: organizationFactory.build() })
              .build(),
            targetType: "project",
          })
          .build({ role: "member" }),
      ]
    : []

  const agentInvitations = withAgentInvitations
    ? (() => {
        const project = projectFactory
          .transient({ organization: organizationFactory.build() })
          .build()
        const agent = agentFactory.transient({ project }).build()
        return [
          pendingInvitationFactory
            .transient({ agent, project, targetType: "agent" })
            .build({ role: "member" }),
        ]
      })()
    : []

  const invitations = [...projectInvitations, ...agentInvitations]

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
    organizationsWithProjects,
    organizationMemberships,
    projectMemberships,
    invitations,
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
    withProjectInvitations: { control: "boolean" },
    withAgentInvitations: { control: "boolean" },
    withReviewCampaignMembershipsAsTester: { control: "boolean" },
    withReviewCampaignMembershipsAsReviewer: { control: "boolean" },
  },
  args: {
    ...baseStoryArgs,
    organizationMembershipRole: "member",
    projectMembershipRole: "member",
    organizationCount: 1,
    projectsPerOrganization: 1,
    withProjectInvitations: false,
    withAgentInvitations: false,
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
          seed.organizations(data.organizationsWithProjects),
          seed.pendingInvitations(data.invitations),
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

export const Empty: Story = {
  args: {
    organizationMembershipRole: "member",
    projectMembershipRole: "member",
    agentMembershipRole: "owner",
    featureFlags: [],
    organizationCount: 0,
    projectsPerOrganization: 0,
    withProjectInvitations: false,
    withAgentInvitations: false,
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
    withProjectInvitations: false,
    withAgentInvitations: false,
    withReviewCampaignMembershipsAsTester: false,
    withReviewCampaignMembershipsAsReviewer: false
  }
};

export const SingleWithInvitations: Story = {
  args: {
    organizationMembershipRole: "member",
    projectMembershipRole: "member",
    agentMembershipRole: "owner",
    featureFlags: [],
    organizationCount: 1,
    projectsPerOrganization: 1,
    withProjectInvitations: true,
    withAgentInvitations: true,
    withReviewCampaignMembershipsAsTester: false,
    withReviewCampaignMembershipsAsReviewer: false
  }
};

export const SingleWithStudioAccess: Story = {
  args: {
    organizationMembershipRole: "member",
    projectMembershipRole: "admin",
    agentMembershipRole: "owner",
    featureFlags: ["evaluation"],
    organizationCount: 1,
    projectsPerOrganization: 1,
    withProjectInvitations: false,
    withAgentInvitations: false,
    withReviewCampaignMembershipsAsTester: true,
    withReviewCampaignMembershipsAsReviewer: true
  }
};

export const Multi: Story = {
  args: {
    organizationMembershipRole: "owner",
    projectMembershipRole: "admin",
    agentMembershipRole: "owner",
    featureFlags: [],
    organizationCount: 2,
    projectsPerOrganization: 3,
    withProjectInvitations: false,
    withAgentInvitations: false,
    withReviewCampaignMembershipsAsTester: true,
    withReviewCampaignMembershipsAsReviewer: true
  }
};
