export enum StudioRouteNames {
  // STUDIO ROUTES
  HOME = "/studio",
  DOCUMENTS = "/o/:organizationId/p/:projectId/d",
  DOCUMENT = "/o/:organizationId/p/:projectId/d/:documentId",
  WEB_SOURCES = "/o/:organizationId/p/:projectId/web-sources",
  PROJECT_ANALYTICS = "/o/:organizationId/p/:projectId/analytics",
  EVALUATION = "/o/:organizationId/p/:projectId/eval",
  PROJECT_MEMBERSHIPS = "/o/:organizationId/p/:projectId/members",
  PROJECT_MEMBERSHIP = "/o/:organizationId/p/:projectId/members/:membershipId",
  FEEDBACK = "/o/:organizationId/p/:projectId/a/:agentId/f",
  AGENT_MEMBERSHIPS = "/o/:organizationId/p/:projectId/a/:agentId/members",
  AGENT_ANALYTICS = "/o/:organizationId/p/:projectId/a/:agentId/analytics",
  REVIEW_CAMPAIGNS = "/o/:organizationId/p/:projectId/review-campaigns",
  REVIEW_CAMPAIGN_REPORT = "/o/:organizationId/p/:projectId/review-campaigns/:reviewCampaignId/report",
}

export const buildStudioPath = (path: string) => {
  return `${StudioRouteNames.HOME}${path}`
}

export const buildDocumentsPath = ({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) => {
  return buildStudioPath(
    StudioRouteNames.DOCUMENTS.replace(":organizationId", organizationId).replace(
      ":projectId",
      projectId,
    ),
  )
}

export const buildWebSourcesPath = ({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) => {
  return buildStudioPath(
    StudioRouteNames.WEB_SOURCES.replace(":organizationId", organizationId).replace(
      ":projectId",
      projectId,
    ),
  )
}

export const buildProjectAnalyticsPath = ({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) => {
  return buildStudioPath(
    StudioRouteNames.PROJECT_ANALYTICS.replace(":organizationId", organizationId).replace(
      ":projectId",
      projectId,
    ),
  )
}

export const buildEvaluationPath = ({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) => {
  return buildStudioPath(
    StudioRouteNames.EVALUATION.replace(":organizationId", organizationId).replace(
      ":projectId",
      projectId,
    ),
  )
}

export const buildFeedbackPath = ({
  organizationId,
  projectId,
  agentId,
}: {
  organizationId: string
  projectId: string
  agentId: string
}) => {
  return buildStudioPath(
    StudioRouteNames.FEEDBACK.replace(":organizationId", organizationId)
      .replace(":projectId", projectId)
      .replace(":agentId", agentId),
  )
}

export const buildProjectMembershipsPath = ({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) => {
  return buildStudioPath(
    StudioRouteNames.PROJECT_MEMBERSHIPS.replace(":organizationId", organizationId).replace(
      ":projectId",
      projectId,
    ),
  )
}

export const buildProjectMembershipPath = ({
  organizationId,
  projectId,
  membershipId,
}: {
  organizationId: string
  projectId: string
  membershipId: string
}) => {
  return buildStudioPath(
    StudioRouteNames.PROJECT_MEMBERSHIP.replace(":organizationId", organizationId)
      .replace(":projectId", projectId)
      .replace(":membershipId", membershipId),
  )
}

export const buildAgentMembershipsPath = ({
  organizationId,
  projectId,
  agentId,
}: {
  organizationId: string
  projectId: string
  agentId: string
}) => {
  return buildStudioPath(
    StudioRouteNames.AGENT_MEMBERSHIPS.replace(":organizationId", organizationId)
      .replace(":projectId", projectId)
      .replace(":agentId", agentId),
  )
}

export const buildAgentAnalyticsPath = ({
  organizationId,
  projectId,
  agentId,
}: {
  organizationId: string
  projectId: string
  agentId: string
}) => {
  return buildStudioPath(
    StudioRouteNames.AGENT_ANALYTICS.replace(":organizationId", organizationId)
      .replace(":projectId", projectId)
      .replace(":agentId", agentId),
  )
}

export const buildReviewCampaignsPath = ({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) => {
  return buildStudioPath(
    StudioRouteNames.REVIEW_CAMPAIGNS.replace(":organizationId", organizationId).replace(
      ":projectId",
      projectId,
    ),
  )
}

export const buildReviewCampaignReportPath = ({
  organizationId,
  projectId,
  reviewCampaignId,
}: {
  organizationId: string
  projectId: string
  reviewCampaignId: string
}) => {
  return buildStudioPath(
    StudioRouteNames.REVIEW_CAMPAIGN_REPORT.replace(":organizationId", organizationId)
      .replace(":projectId", projectId)
      .replace(":reviewCampaignId", reviewCampaignId),
  )
}

export const isStudioInterface = () => window.location.pathname.startsWith(StudioRouteNames.HOME)
