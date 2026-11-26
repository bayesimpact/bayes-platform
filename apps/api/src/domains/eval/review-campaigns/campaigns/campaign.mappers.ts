import type {
  CampaignContextOutputDto,
  CampaignInvitationOutputDto,
  CampaignReportDistributionOutputDto,
  CampaignReportOutputDto,
  CampaignReportSessionOutputDto,
  MyReviewCampaignOutputDto,
  ReviewCampaignDetailOutputDto,
  ReviewCampaignMembershipOutputDto,
  ReviewCampaignOutputDto,
  ReviewCampaignQuestionDto,
} from "@bayes-platform/eval-contracts"
import type { EndpointRequestWithReviewCampaign } from "@/common/context/request.interface"
import type { InvitationsService } from "@/domains/invitations/invitations.service"
import type { ReportsService } from "@/domains/review-campaigns/reports/reports.service"
import type { ReviewCampaignsService } from "@/domains/review-campaigns/review-campaigns.service"
import type { TesterService } from "@/domains/review-campaigns/tester/tester.service"

type ReviewCampaign = EndpointRequestWithReviewCampaign["reviewCampaign"]

type ReviewCampaignQuestion = ReviewCampaign["testerPerSessionQuestions"][number]

type ReviewCampaignDetail = Awaited<ReturnType<ReviewCampaignsService["getDetail"]>>

type ReviewCampaignMembership = ReviewCampaignDetail["memberships"][number]

type CampaignContext = Awaited<ReturnType<TesterService["getTesterContext"]>>

type CampaignReport = Awaited<ReturnType<ReportsService["computeReport"]>>

type CampaignReportDistribution = CampaignReport["reviewerDistributions"][number]

type CampaignReportSessionRow = CampaignReport["sessionMatrix"][number]

type Invitation = Awaited<ReturnType<InvitationsService["toDtos"]>>[number]

function toQuestionDto(question: ReviewCampaignQuestion): ReviewCampaignQuestionDto {
  return {
    id: question.id,
    prompt: question.prompt,
    type: question.type,
    required: question.required,
    options: question.options,
    isFactual: question.isFactual,
  }
}

/** A campaign, with the fields Evaluation reads. */
export function toReviewCampaignDto(campaign: ReviewCampaign): ReviewCampaignOutputDto {
  return {
    id: campaign.id,
    organizationId: campaign.organizationId,
    projectId: campaign.projectId,
    agentId: campaign.agentId,
    agentSettingsId: campaign.agentSettingsId,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    testerPerSessionQuestions: campaign.testerPerSessionQuestions.map(toQuestionDto),
    testerEndOfPhaseQuestions: campaign.testerEndOfPhaseQuestions.map(toQuestionDto),
    reviewerQuestions: campaign.reviewerQuestions.map(toQuestionDto),
    createdAt: campaign.createdAt.getTime(),
    updatedAt: campaign.updatedAt.getTime(),
  }
}

/**
 * One entry per person, with every role they hold on the campaign, each with its row id.
 */
function toReviewCampaignMembershipDtos(
  memberships: ReviewCampaignMembership[],
): ReviewCampaignMembershipOutputDto[] {
  const membershipsByUserId = new Map<string, ReviewCampaignMembership[]>()
  for (const membership of memberships) {
    const roleGrants = membershipsByUserId.get(membership.userId)
    if (roleGrants) roleGrants.push(membership)
    else membershipsByUserId.set(membership.userId, [membership])
  }

  return [...membershipsByUserId.values()].flatMap((roleGrants) => {
    const [first] = roleGrants
    if (!first) return []
    return [
      {
        userId: first.userId,
        userEmail: first.user?.email ?? "",
        userHasSignedIn: first.user ? first.user.authSubject !== null : false,
        roles: roleGrants.map((membership) => ({
          membershipId: membership.membershipRole.membershipId,
          key: membership.membershipRole.key,
        })),
      },
    ]
  })
}

/** A campaign with its members and, once it is closed, its aggregates. */
export function toReviewCampaignDetailDto({
  campaign,
  memberships,
  aggregates,
}: ReviewCampaignDetail): ReviewCampaignDetailOutputDto {
  return {
    ...toReviewCampaignDto(campaign),
    memberships: toReviewCampaignMembershipDtos(memberships),
    aggregates: aggregates
      ? {
          meanTesterRating: aggregates.meanTesterRating,
          surveyCount: aggregates.surveyCount,
          sessionCount: aggregates.sessionCount,
        }
      : null,
  }
}

/** A campaign the signed-in person tests or reviews. */
export function toMyCampaignDto(campaign: ReviewCampaign): MyReviewCampaignOutputDto {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    agentId: campaign.agentId,
    createdAt: campaign.createdAt.getTime(),
    organizationId: campaign.organizationId,
    projectId: campaign.projectId,
    // The relation is loaded with the person's campaigns; a deleted agent leaves it empty.
    agent: campaign.agent ? { name: campaign.agent.name, type: campaign.agent.type } : null,
  }
}

/** What a participant needs to know of a campaign, with the fields Evaluation reads. */
export function toCampaignContextDto(
  campaign: ReviewCampaign,
  { agent, agentSettings }: CampaignContext,
): CampaignContextOutputDto {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    agent: {
      id: agent.id,
      name: agent.name,
      type: agent.type,
      greetingMessage: agentSettings.greetingMessage ?? undefined,
    },
    testerPerSessionQuestions: campaign.testerPerSessionQuestions.map(toQuestionDto),
    testerEndOfPhaseQuestions: campaign.testerEndOfPhaseQuestions.map(toQuestionDto),
  }
}

function toReportDistributionDto(
  distribution: CampaignReportDistribution,
): CampaignReportDistributionOutputDto {
  return {
    questionId: distribution.questionId,
    prompt: distribution.prompt,
    type: distribution.type,
    responseCount: distribution.responseCount,
    buckets: distribution.buckets.map((bucket) => ({ label: bucket.label, count: bucket.count })),
    textAnswers: distribution.textAnswers,
  }
}

/** A row of the report's session matrix, with the fields Evaluation reads. */
function toReportSessionDto(row: CampaignReportSessionRow): CampaignReportSessionOutputDto {
  return {
    sessionId: row.sessionId,
    testerUserId: row.testerUserId,
    startedAt: row.startedAt.getTime(),
    testerRating: row.testerRating,
    reviewerRatings: row.reviewerRatings,
    reviewerCount: row.reviewerCount,
    meanReviewerRating: row.meanReviewerRating,
    reviewerRatingSpread: row.reviewerRatingSpread,
    testerAnswers: row.testerAnswers,
    reviewerAnswers: row.reviewerAnswers,
    endOfPhaseAnswers: row.endOfPhaseAnswers,
  }
}

/** The report of a campaign, with the fields Evaluation reads. */
export function toCampaignReportDto(report: CampaignReport): CampaignReportOutputDto {
  return {
    showsAnswers: report.showsAnswers,
    headline: {
      sessionCount: report.headline.sessionCount,
      testerFeedbackCount: report.headline.testerFeedbackCount,
      reviewerReviewCount: report.headline.reviewerReviewCount,
      meanTesterRating: report.headline.meanTesterRating,
      meanReviewerRating: report.headline.meanReviewerRating,
      meanEndOfPhaseRating: report.headline.meanEndOfPhaseRating,
      participantCount: report.headline.participantCount,
    },
    testerPerSessionDistributions:
      report.testerPerSessionDistributions.map(toReportDistributionDto),
    testerEndOfPhaseDistributions:
      report.testerEndOfPhaseDistributions.map(toReportDistributionDto),
    reviewerDistributions: report.reviewerDistributions.map(toReportDistributionDto),
    sessionMatrix: report.sessionMatrix.map(toReportSessionDto),
  }
}

/** An invitation as `InvitationsService.toDtos` gives it, with the fields Evaluation reads. */
export function toCampaignInvitationDto(invitation: Invitation): CampaignInvitationOutputDto {
  return {
    id: invitation.id,
    invitedEmail: invitation.invitedEmail,
    role: invitation.role,
    status: invitation.status,
    invitedAt: invitation.invitedAt,
  }
}
