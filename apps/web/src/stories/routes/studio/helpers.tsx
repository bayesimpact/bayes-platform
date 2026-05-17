import { agentFactory } from "@/common/features/agents/agent.factory"
import type { Agent } from "@/common/features/agents/agents.models"
import {
  organizationMembershipFactory,
  projectMembershipFactory,
  userFactory,
} from "@/common/features/me/me.factory"
import type { User } from "@/common/features/me/me.models"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import type { Organization } from "@/common/features/organizations/organizations.models"
import { projectFactory } from "@/common/features/projects/projects.factory"
import type { Project } from "@/common/features/projects/projects.models"
import type { StoryPreloadedState } from "@/stories/decorators"
import {
  type BaseStoryArgs,
  baseStoryArgs,
  baseStoryArgTypes,
  sortRecentlyCreated,
} from "@/stories/helpers"
import { mergeSeeds, seed } from "@/stories/seed"

export type StudioStoryArgs = BaseStoryArgs & {
  withAgents?: boolean
}

export const studioStoryArgs = {
  ...baseStoryArgs,
  withAgents: false,
} satisfies StudioStoryArgs

export const studioStoryArgTypes = {
  ...baseStoryArgTypes,
  withAgents: { control: "boolean" },
} as const

export function buildStudioData(input: StudioStoryArgs): {
  user: User
  organization: Organization
  project: Project
  agents: Agent[]
  baseSeeds: StoryPreloadedState
} {
  const { organizationMembershipRole, projectMembershipRole, featureFlags, withAgents } = input
  const organization = organizationFactory.build()
  const organizationMemberships = [
    organizationMembershipFactory
      .transient({ organization })
      .build({ role: organizationMembershipRole }),
  ]
  const project = projectFactory.transient({ organization }).build()
  const projectMemberships = [
    projectMembershipFactory.transient({ project }).build({ role: projectMembershipRole }),
  ]
  const agents = withAgents
    ? agentFactory.transient({ project }).buildList(3).sort(sortRecentlyCreated)
    : []
  const user = userFactory.transient({ organizationMemberships, projectMemberships }).build()
  const seededProject = featureFlags !== undefined ? { ...project, featureFlags } : project
  const baseSeeds = mergeSeeds(
    seed.me(user),
    seed.organizations([organization], { currentId: organization.id }),
    seed.projects([seededProject], { currentId: seededProject.id }),
    seed.agents(agents),
  )
  return { user, organization, project, agents, baseSeeds }
}
