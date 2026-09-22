import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { Repository } from "typeorm"
import type { User } from "./user.entity"
import { USER_TYPE_HUMAN } from "./user.types"

export const userFactory = Factory.define<User>(({ sequence, params }) => {
  const now = new Date()
  return {
    id: params.id || randomUUID(),
    auth0Id: params.auth0Id || `auth0|${randomUUID()}`,
    email: params.email || `user${sequence}@example.com`,
    type: params.type ?? USER_TYPE_HUMAN,
    name: params.name ?? `Test User ${sequence}`,
    pictureUrl: params.pictureUrl ?? null,
    createdAt: params.createdAt || now,
    updatedAt: params.updatedAt || now,
    deletedAt: null,
    userMemberships: params.userMemberships || [],
    conversationAgentSessions: params.conversationAgentSessions || [],
    agentMessageFeedbacks: params.agentMessageFeedbacks || [],
    testerCampaignSurveys: params.testerCampaignSurveys || [],
    reviewerSessionReviews: params.reviewerSessionReviews || [],
  } satisfies User
})

export const createSingleUser = async (
  repository: Repository<User>,
  userParams: Partial<User> = {},
): Promise<User> => {
  const user = userFactory.build(userParams)
  await repository.save(user)
  return user
}
