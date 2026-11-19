import {
  type CampaignReportOutputDto,
  EvalCampaignInvitationsRoutes,
  EvalConversationsRoutes,
  EvalDocumentsRoutes,
  EvalReviewCampaignsRoutes,
  EvalReviewerRoutes,
  EvalTesterRoutes,
  type MeOutputDto,
  type ReviewCampaignDetailOutputDto,
} from "@caseai-connect/eval-contracts"
import { buildConversationMessage, buildToolCall } from "../factories/conversations.factory"
import type { EvalWorld } from "../factories/eval-world.factory"
import {
  buildCampaignInvitation,
  buildReviewCampaign,
  buildReviewerReview,
  buildTesterSession,
  type ReviewSessionRecord,
} from "../factories/review-campaigns.factory"
import { apiError, type MockStreamFrame, mockRoute, mockStreamRoute } from "./mock-route"

const EMPTY_REPORT: CampaignReportOutputDto = {
  headline: {
    sessionCount: 0,
    testerFeedbackCount: 0,
    reviewerReviewCount: 0,
    meanTesterRating: null,
    meanReviewerRating: null,
    meanEndOfPhaseRating: null,
    participantCount: 0,
  },
  testerPerSessionDistributions: [],
  testerEndOfPhaseDistributions: [],
  reviewerDistributions: [],
  sessionMatrix: [],
}

const memberCountOf = (campaign: ReviewCampaignDetailOutputDto) => campaign.memberships.length

/** The campaigns of a project, for who manages them: list, create, change, delete, people. */
function managementHandlers(world: EvalWorld) {
  const find = (reviewCampaignId: string) =>
    world.campaigns.find((campaign) => campaign.id === reviewCampaignId)
  return [
    mockRoute(EvalReviewCampaignsRoutes.getAllOfProject, ({ params }) => ({
      reviewCampaigns: world.campaigns
        .filter((campaign) => campaign.projectId === params.projectId)
        .map((campaign) => ({ ...campaign, memberCount: memberCountOf(campaign) })),
    })),
    mockRoute(
      EvalReviewCampaignsRoutes.getOne,
      ({ params }) => find(params.reviewCampaignId) ?? apiError(404),
    ),
    mockRoute(EvalReviewCampaignsRoutes.createOne, ({ params, payload }) => {
      const agent = world.agents.find((candidate) => candidate.id === payload.agentId)
      if (!agent) return apiError(422, `Agent ${payload.agentId} not found in this project`)
      const campaign = buildReviewCampaign(agent, params.organizationId, {
        ...payload,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      world.campaigns.unshift(campaign)
      return campaign
    }),
    mockRoute(EvalReviewCampaignsRoutes.updateOne, ({ params, payload }) => {
      const campaign = find(params.reviewCampaignId)
      if (!campaign) return apiError(404)
      const { status, ...config } = payload
      if (Object.keys(config).length > 0 && campaign.status !== "draft") {
        return apiError(
          409,
          "Campaign configuration can only be edited while the campaign is in draft",
        )
      }
      Object.assign(campaign, config, { updatedAt: Date.now() })
      if (status) {
        campaign.status = status
        if (status === "closed") {
          campaign.aggregates = { meanTesterRating: null, surveyCount: 0, sessionCount: 0 }
        }
      }
      return campaign
    }),
    mockRoute(EvalReviewCampaignsRoutes.deleteOne, ({ params }) => {
      world.campaigns = world.campaigns.filter(
        (campaign) => campaign.id !== params.reviewCampaignId,
      )
      return { success: true }
    }),
    mockRoute(EvalReviewCampaignsRoutes.revokeMembership, ({ params }) => {
      const campaign = find(params.reviewCampaignId)
      if (!campaign) return apiError(404)
      campaign.memberships = campaign.memberships.flatMap((membership) => {
        const roles = membership.roles.filter((role) => role.membershipId !== params.membershipId)
        return roles.length > 0 ? [{ ...membership, roles }] : []
      })
      return { success: true }
    }),
    mockRoute(
      EvalReviewCampaignsRoutes.getReport,
      ({ params }) => world.reports[params.reviewCampaignId] ?? EMPTY_REPORT,
    ),
    mockRoute(EvalCampaignInvitationsRoutes.getAll, ({ params }) => ({
      invitations: world.invitations[params.reviewCampaignId] ?? [],
    })),
    mockRoute(EvalCampaignInvitationsRoutes.createMany, ({ params, payload }) => {
      const pending = world.invitations[params.reviewCampaignId] ?? []
      // As the API does, an email that already has an invitation for the role is left out.
      const invitations = payload.emails
        .filter(
          (email) =>
            !pending.some(
              (invitation) => invitation.invitedEmail === email && invitation.role === payload.role,
            ),
        )
        .map((email) =>
          buildCampaignInvitation({
            invitedEmail: email,
            role: payload.role,
            invitedAt: Date.now(),
          }),
        )
      world.invitations[params.reviewCampaignId] = [...invitations, ...pending]
      return { invitations, emailSent: true }
    }),
    mockRoute(EvalCampaignInvitationsRoutes.deleteOne, ({ params }) => {
      world.invitations[params.reviewCampaignId] = (
        world.invitations[params.reviewCampaignId] ?? []
      ).filter((invitation) => invitation.id !== params.invitationId)
      return { success: true }
    }),
  ]
}

/** The name and type of a campaign's agent, as the person's campaigns carry them. */
function agentSnapshotOf(world: EvalWorld, agentId: string) {
  const agent = world.agents.find((candidate) => candidate.id === agentId)
  return agent ? { name: agent.name, type: agent.type } : null
}

/** What the signed-in person reads as a participant: their campaigns, and each one's context. */
function participantHandlers(world: EvalWorld) {
  return [
    mockRoute(EvalReviewCampaignsRoutes.getAllMine, ({ query }) => ({
      reviewCampaigns: world.campaigns
        .filter((campaign) => {
          const roles = world.myCampaignRoles[campaign.id] ?? []
          // As the API does: a draft is nobody's yet, and a tester's campaign leaves once closed.
          const isListed =
            query.role === "tester" ? campaign.status === "active" : campaign.status !== "draft"
          return roles.includes(query.role) && isListed
        })
        .map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          status: campaign.status,
          organizationId: campaign.organizationId,
          projectId: campaign.projectId,
          agentId: campaign.agentId,
          createdAt: campaign.createdAt,
          agent: agentSnapshotOf(world, campaign.agentId),
        })),
    })),
    mockRoute(EvalReviewCampaignsRoutes.getContext, ({ params }) => {
      const campaign = world.campaigns.find((candidate) => candidate.id === params.reviewCampaignId)
      const agent = world.agents.find((candidate) => candidate.id === campaign?.agentId)
      if (!campaign || !agent) return apiError(404)
      if (campaign.status === "draft") {
        return apiError(403, "This action is not available on a draft campaign")
      }
      return {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        status: campaign.status,
        agent: {
          id: agent.id,
          name: agent.name,
          type: agent.type,
          greetingMessage: "Hello! Ask me anything about our plans and prices.",
        },
        testerPerSessionQuestions: campaign.testerPerSessionQuestions,
        testerEndOfPhaseQuestions: campaign.testerEndOfPhaseQuestions,
      }
    }),
  ]
}

/** A session as a reviewer gets it: blind before their own review, whole after. */
function reviewerViewOf(world: EvalWorld, campaignId: string, session: ReviewSessionRecord) {
  const campaign = world.campaigns.find((candidate) => candidate.id === campaignId)
  const agent = world.agents.find((candidate) => candidate.id === campaign?.agentId)
  if (!campaign || !agent) return apiError(404)
  const common = {
    sessionId: session.sessionId,
    testerUserId: session.testerUserId,
    startedAt: session.startedAt,
    agent: { id: agent.id, name: agent.name, type: agent.type },
    transcript: session.transcript,
    reviewerQuestions: campaign.reviewerQuestions,
    otherReviewerCount: session.otherReviews.length,
    formResult: session.formResult,
  }
  if (session.myReview === null) {
    const factualQuestions = campaign.testerPerSessionQuestions.filter(
      (question) => question.isFactual === true && question.type !== "free-text",
    )
    return {
      ...common,
      blind: true as const,
      factualTesterQuestions: factualQuestions,
      factualTesterAnswers: (session.testerFeedback?.answers ?? []).filter((answer) =>
        factualQuestions.some((question) => question.id === answer.questionId),
      ),
    }
  }
  return {
    ...common,
    blind: false as const,
    testerPerSessionQuestions: campaign.testerPerSessionQuestions,
    testerFeedback: session.testerFeedback,
    myReview: session.myReview,
    otherReviews: session.otherReviews,
  }
}

/** What a reviewer does: list the sessions, read one, and give or change their review. */
function reviewerHandlers(world: EvalWorld, me: MeOutputDto) {
  const find = (campaignId: string, sessionId: string) =>
    (world.reviewSessions[campaignId] ?? []).find((session) => session.sessionId === sessionId)
  return [
    mockRoute(EvalReviewerRoutes.getSessions, ({ params }) => ({
      sessions: (world.reviewSessions[params.reviewCampaignId] ?? []).map((session) => ({
        sessionId: session.sessionId,
        startedAt: session.startedAt,
        messageCount: session.transcript.length,
        reviewerCount: session.otherReviews.length + (session.myReview ? 1 : 0),
        callerHasReviewed: session.myReview !== null,
        callerIsSessionOwner: session.testerUserId === me.user.id,
      })),
    })),
    mockRoute(EvalReviewerRoutes.getSession, ({ params }) => {
      const session = find(params.reviewCampaignId, params.sessionId)
      return session ? reviewerViewOf(world, params.reviewCampaignId, session) : apiError(404)
    }),
    mockRoute(EvalReviewerRoutes.createReview, ({ params, payload }) => {
      const session = find(params.reviewCampaignId, params.sessionId)
      if (!session) return apiError(404)
      if (session.myReview) return apiError(409, "Review already submitted for this session")
      session.myReview = buildReviewerReview({ ...payload, reviewerUserId: me.user.id })
      return session.myReview
    }),
    mockRoute(EvalReviewerRoutes.updateReview, ({ params, payload }) => {
      const session = find(params.reviewCampaignId, params.sessionId)
      if (!session?.myReview) return apiError(404)
      session.myReview = { ...session.myReview, ...payload }
      return session.myReview
    }),
  ]
}

/** What a tester does: their sessions, their feedback on each, and their final survey. */
function testerHandlers(world: EvalWorld) {
  const findSession = (sessionId: string) =>
    Object.values(world.testerSessions)
      .flat()
      .find((session) => session.id === sessionId)
  return [
    mockRoute(EvalTesterRoutes.getSessions, ({ params }) => ({
      sessions: world.testerSessions[params.reviewCampaignId] ?? [],
    })),
    mockRoute(EvalTesterRoutes.startSession, ({ params }) => {
      const campaign = world.campaigns.find((candidate) => candidate.id === params.reviewCampaignId)
      if (!campaign) return apiError(404)
      const session = buildTesterSession(campaign.agentId, { createdAt: Date.now() })
      world.testerSessions[campaign.id] = [session, ...(world.testerSessions[campaign.id] ?? [])]
      // As the API does, a new session starts with the agent's greeting.
      world.testerMessages[session.id] = [buildConversationMessage()]
      return { id: session.id }
    }),
    mockRoute(EvalTesterRoutes.deleteSession, ({ params }) => {
      for (const [campaignId, sessions] of Object.entries(world.testerSessions)) {
        world.testerSessions[campaignId] = sessions.filter(
          (session) => session.id !== params.sessionId,
        )
      }
      return { success: true }
    }),
    mockRoute(EvalTesterRoutes.createFeedback, ({ params, payload }) => {
      const session = findSession(params.sessionId)
      if (!session) return apiError(404)
      if (session.feedbackStatus === "submitted") {
        return apiError(409, "Feedback already submitted for this session")
      }
      session.feedbackStatus = "submitted"
      return { id: crypto.randomUUID(), sessionId: session.id, ...payload }
    }),
    mockRoute(EvalTesterRoutes.getSurvey, ({ params }) => ({
      survey: world.testerSurveys[params.reviewCampaignId] ?? null,
    })),
    mockRoute(EvalTesterRoutes.createSurvey, ({ params, payload }) => {
      const survey = { id: crypto.randomUUID(), ...payload }
      world.testerSurveys[params.reviewCampaignId] = survey
      return survey
    }),
    mockRoute(EvalTesterRoutes.updateSurvey, ({ params, payload }) => {
      const current = world.testerSurveys[params.reviewCampaignId]
      if (!current) return apiError(404)
      const survey = { ...current, ...payload }
      world.testerSurveys[params.reviewCampaignId] = survey
      return survey
    }),
  ]
}

type ReplyFrame = MockStreamFrame<typeof EvalConversationsRoutes.streamReply>

/** The words of a reply, two by two, as the chunks of its stream. */
function chunksOf(text: string): string[] {
  const words = text.split(" ")
  const chunks: string[] = []
  for (let index = 0; index < words.length; index += 2) {
    chunks.push(`${index > 0 ? " " : ""}${words.slice(index, index + 2).join(" ")}`)
  }
  return chunks
}

/** A tester's conversation with the agent: read its messages, and send one, which gets a reply. */
function conversationHandlers(world: EvalWorld) {
  return [
    mockRoute(
      EvalConversationsRoutes.getMessages,
      ({ params }) => world.testerMessages[params.agentSessionId] ?? apiError(404),
    ),
    mockRoute(EvalConversationsRoutes.getMcpAppsHtml, () => []),
    mockRoute(EvalConversationsRoutes.createMessageFeedback, () => ({ success: true })),
    mockRoute(EvalDocumentsRoutes.getIsPublic, () => ({ isPublicDocument: true })),
    mockRoute(EvalDocumentsRoutes.getTemporaryUrl, () => ({
      url: "https://example.org/pricing-guide.pdf",
    })),
    mockStreamRoute(EvalConversationsRoutes.streamReply, ({ params, payload }) => {
      const reply = buildConversationMessage({
        content:
          `Here is what I found about "${payload.content}". ` +
          "The answer depends on your plan, so here are the options that apply to you:\n\n" +
          "1. **Starter**, for a single team.\n2. **Pro**, for several teams.",
        toolCalls: [buildToolCall()],
      })
      world.testerMessages[params.agentSessionId] = [
        ...(world.testerMessages[params.agentSessionId] ?? []),
        buildConversationMessage({ role: "user", content: payload.content }),
        reply,
      ]
      return [
        { event: { type: "start", messageId: reply.id } },
        { event: { type: "notify_client", toolName: "lookup_knowledge_base" } },
        ...chunksOf(reply.content).map(
          (chunk): ReplyFrame => ({
            event: { type: "chunk", messageId: reply.id, content: chunk },
          }),
        ),
        { event: { type: "end", messageId: reply.id, fullContent: reply.content } },
      ]
    }),
  ]
}

/** Every route of the review campaigns, answered from a world, for the signed-in person. */
export function campaignHandlers(world: EvalWorld, me: MeOutputDto) {
  return [
    ...managementHandlers(world),
    ...participantHandlers(world),
    ...reviewerHandlers(world, me),
    ...testerHandlers(world),
    ...conversationHandlers(world),
  ]
}
