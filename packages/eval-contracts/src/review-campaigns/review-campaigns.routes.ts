import { z } from "zod"
import { LEGACY_PROJECT_PATH, PROJECT_PATH, projectParamsSchema } from "../common/params.dto"
import { mcpAppHtmlOutputSchema } from "../conversations/conversations.dto"
import { defineSchemaRoute } from "../define-schema-route"
import {
  campaignInvitationParamsSchema,
  campaignInvitationsOutputSchema,
  createCampaignInvitationsInputSchema,
  createCampaignInvitationsOutputSchema,
} from "./invitations.dto"
import { campaignReportOutputSchema } from "./report.dto"
import {
  createReviewCampaignInputSchema,
  myReviewCampaignsOutputSchema,
  myReviewCampaignsQuerySchema,
  reviewCampaignDetailOutputSchema,
  reviewCampaignMembershipParamsSchema,
  reviewCampaignOutputSchema,
  reviewCampaignParamsSchema,
  reviewCampaignsOutputSchema,
  successOutputSchema,
  updateReviewCampaignInputSchema,
} from "./review-campaigns.dto"
import {
  campaignSessionParamsSchema,
  ratedFeedbackInputSchema,
  reviewerReviewOutputSchema,
  reviewerReviewParamsSchema,
  reviewerSessionOutputSchema,
  reviewerSessionsOutputSchema,
} from "./reviewer.dto"
import {
  campaignContextOutputSchema,
  myTesterSurveyOutputSchema,
  startTesterSessionInputSchema,
  startTesterSessionOutputSchema,
  testerFeedbackOutputSchema,
  testerSessionParamsSchema,
  testerSessionsOutputSchema,
  testerSurveyOutputSchema,
} from "./tester.dto"

const CAMPAIGNS_PATH = `${PROJECT_PATH}/review-campaigns`
const CAMPAIGN_PATH = `${CAMPAIGNS_PATH}/:reviewCampaignId`

/**
 * The path of a campaign before the API served the Evaluation routes under `eval/`. The reviewer
 * and tester routes keep it until they move.
 */
const LEGACY_CAMPAIGN_PATH = `${LEGACY_PROJECT_PATH}/review-campaigns/:reviewCampaignId`

/** The campaigns of a project, for the people who manage them. */
export const EvalReviewCampaignsRoutes = {
  getAllOfProject: defineSchemaRoute({
    method: "get",
    path: CAMPAIGNS_PATH,
    params: projectParamsSchema,
    response: reviewCampaignsOutputSchema,
  }),
  getOne: defineSchemaRoute({
    method: "get",
    path: CAMPAIGN_PATH,
    params: reviewCampaignParamsSchema,
    response: reviewCampaignDetailOutputSchema,
  }),
  createOne: defineSchemaRoute({
    method: "post",
    path: CAMPAIGNS_PATH,
    params: projectParamsSchema,
    body: createReviewCampaignInputSchema,
    response: reviewCampaignOutputSchema,
  }),
  updateOne: defineSchemaRoute({
    method: "patch",
    path: CAMPAIGN_PATH,
    params: reviewCampaignParamsSchema,
    body: updateReviewCampaignInputSchema,
    response: reviewCampaignOutputSchema,
  }),
  deleteOne: defineSchemaRoute({
    method: "delete",
    path: CAMPAIGN_PATH,
    params: reviewCampaignParamsSchema,
    response: successOutputSchema,
  }),
  revokeMembership: defineSchemaRoute({
    method: "delete",
    path: `${CAMPAIGN_PATH}/memberships/:membershipId`,
    params: reviewCampaignMembershipParamsSchema,
    response: successOutputSchema,
  }),
  getReport: defineSchemaRoute({
    method: "get",
    path: `${CAMPAIGN_PATH}/report`,
    params: reviewCampaignParamsSchema,
    response: campaignReportOutputSchema,
  }),
  /** A campaign as its testers and reviewers see it: not a draft. */
  getContext: defineSchemaRoute({
    method: "get",
    path: `${CAMPAIGN_PATH}/tester-context`,
    params: reviewCampaignParamsSchema,
    response: campaignContextOutputSchema,
  }),
  /** The campaigns the signed-in person tests, or reviews. */
  getAllMine: defineSchemaRoute({
    method: "get",
    path: "eval/me/review-campaigns",
    query: myReviewCampaignsQuerySchema,
    response: myReviewCampaignsOutputSchema,
  }),
}

/** The invitations to a campaign that wait for an answer. */
export const EvalCampaignInvitationsRoutes = {
  getAll: defineSchemaRoute({
    method: "get",
    path: `${CAMPAIGN_PATH}/invitations`,
    params: reviewCampaignParamsSchema,
    response: campaignInvitationsOutputSchema,
  }),
  createMany: defineSchemaRoute({
    method: "post",
    path: `${CAMPAIGN_PATH}/invitations`,
    params: reviewCampaignParamsSchema,
    body: createCampaignInvitationsInputSchema,
    response: createCampaignInvitationsOutputSchema,
  }),
  deleteOne: defineSchemaRoute({
    method: "delete",
    path: `${CAMPAIGN_PATH}/invitations/:invitationId`,
    params: campaignInvitationParamsSchema,
    response: successOutputSchema,
  }),
}

/** What a reviewer does in a campaign. */
export const EvalReviewerRoutes = {
  getSessions: defineSchemaRoute({
    method: "get",
    path: `${CAMPAIGN_PATH}/reviewer-sessions`,
    params: reviewCampaignParamsSchema,
    response: reviewerSessionsOutputSchema,
  }),
  getSession: defineSchemaRoute({
    method: "get",
    path: `${CAMPAIGN_PATH}/agent-sessions/:sessionId/reviewer-view`,
    params: campaignSessionParamsSchema,
    response: reviewerSessionOutputSchema,
  }),
  /** The current HTML of the MCP Apps the session's replies show, as the tester's chat reads it. */
  getSessionMcpAppHtml: defineSchemaRoute({
    method: "get",
    path: `${CAMPAIGN_PATH}/agent-sessions/:sessionId/reviewer-view/mcp-app-html`,
    params: campaignSessionParamsSchema,
    response: z.array(mcpAppHtmlOutputSchema),
  }),
  createReview: defineSchemaRoute({
    method: "post",
    path: `${CAMPAIGN_PATH}/agent-sessions/:sessionId/reviewer-reviews`,
    params: campaignSessionParamsSchema,
    body: ratedFeedbackInputSchema,
    response: reviewerReviewOutputSchema,
  }),
  updateReview: defineSchemaRoute({
    method: "patch",
    path: `${CAMPAIGN_PATH}/agent-sessions/:sessionId/reviewer-reviews/:reviewId`,
    params: reviewerReviewParamsSchema,
    body: ratedFeedbackInputSchema,
    response: reviewerReviewOutputSchema,
  }),
}

/** The path of a tester's session before the API served the Evaluation routes under `eval/`. */
const TESTER_SESSION_PATH = `${LEGACY_PROJECT_PATH}/agent-sessions/:sessionId`

/** What a tester does in a campaign. */
export const EvalTesterRoutes = {
  getSessions: defineSchemaRoute({
    method: "get",
    path: `${LEGACY_CAMPAIGN_PATH}/my-tester-sessions`,
    params: reviewCampaignParamsSchema,
    response: testerSessionsOutputSchema,
  }),
  startSession: defineSchemaRoute({
    method: "post",
    path: `${LEGACY_CAMPAIGN_PATH}/agent-sessions`,
    params: reviewCampaignParamsSchema,
    body: startTesterSessionInputSchema,
    response: startTesterSessionOutputSchema,
  }),
  deleteSession: defineSchemaRoute({
    method: "delete",
    path: `${TESTER_SESSION_PATH}/tester-session`,
    params: testerSessionParamsSchema,
    response: successOutputSchema,
  }),
  createFeedback: defineSchemaRoute({
    method: "post",
    path: `${TESTER_SESSION_PATH}/tester-feedback`,
    params: testerSessionParamsSchema,
    body: ratedFeedbackInputSchema,
    response: testerFeedbackOutputSchema,
  }),
  getSurvey: defineSchemaRoute({
    method: "get",
    path: `${LEGACY_CAMPAIGN_PATH}/tester-survey`,
    params: reviewCampaignParamsSchema,
    response: myTesterSurveyOutputSchema,
  }),
  createSurvey: defineSchemaRoute({
    method: "post",
    path: `${LEGACY_CAMPAIGN_PATH}/tester-survey`,
    params: reviewCampaignParamsSchema,
    body: ratedFeedbackInputSchema,
    response: testerSurveyOutputSchema,
  }),
  updateSurvey: defineSchemaRoute({
    method: "patch",
    path: `${LEGACY_CAMPAIGN_PATH}/tester-survey`,
    params: reviewCampaignParamsSchema,
    body: ratedFeedbackInputSchema,
    response: testerSurveyOutputSchema,
  }),
}
