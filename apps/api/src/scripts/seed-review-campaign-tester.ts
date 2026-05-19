import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { DataSource, In } from "typeorm"
import { AppModule } from "@/app.module"
import { Agent } from "@/domains/agents/agent.entity"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import { ReviewCampaignMembership } from "@/domains/review-campaigns/memberships/review-campaign-membership.entity"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import { User } from "@/domains/users/user.entity"
import { ask, confirmDatabaseTarget } from "@/scripts/script-bootstrap"

const logger = new Logger("SeedReviewCampaignTester")

/**
 * Dev helper: create (or reuse) an active review campaign and seed an accepted
 * tester membership for the given user. Bypasses the Auth0 invite round-trip so
 * you can iterate on the tester UI without a real email flow.
 *
 * Run from apps/api: `npm run seed:review-campaign-tester`.
 *
 * Safety: refuses to run without confirming the target database; logs the URL
 * the tester can open at the end.
 */
async function main(): Promise<void> {
  await confirmDatabaseTarget(logger)

  const email = (await ask("Tester email: ")).toLowerCase()
  if (!email) {
    logger.error("Email is required")
    process.exit(1)
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  })

  try {
    const dataSource = app.get(DataSource)
    const userRepo = dataSource.getRepository(User)
    const projectMembershipRepo = dataSource.getRepository(ProjectMembership)
    const agentRepo = dataSource.getRepository(Agent)
    const campaignRepo = dataSource.getRepository(ReviewCampaign)
    const membershipRepo = dataSource.getRepository(ReviewCampaignMembership)

    const user = await userRepo.findOne({ where: { email } })
    if (!user) {
      logger.error(`No user found with email ${email}. Sign them in once first.`)
      process.exit(1)
    }

    const projectMemberships = await projectMembershipRepo.find({
      where: { userId: user.id, role: In(["owner", "admin"]) },
      relations: ["project"],
      order: { createdAt: "DESC" },
    })
    const firstProject = projectMemberships.find((m) => m.project)?.project
    if (!firstProject) {
      logger.error(
        `User ${email} has no project where they are owner/admin. Create one via the studio UI first.`,
      )
      process.exit(1)
    }
    logger.log(`Using project ${firstProject.name} (${firstProject.id})`)

    const agent = await agentRepo.findOne({
      where: [
        {
          organizationId: firstProject.organizationId,
          projectId: firstProject.id,
          type: "conversation",
        },
        {
          organizationId: firstProject.organizationId,
          projectId: firstProject.id,
          type: "form",
        },
      ],
      order: { createdAt: "ASC" },
    })
    if (!agent) {
      logger.error(
        `Project ${firstProject.name} has no conversation or form agents. Extraction agents are not supported by the tester flow yet.`,
      )
      process.exit(1)
    }
    logger.log(`Using agent ${agent.name} (${agent.id}, type=${agent.type})`)

    let campaign = await campaignRepo.findOne({
      where: {
        organizationId: firstProject.organizationId,
        projectId: firstProject.id,
        agentId: agent.id,
        status: "active",
      },
      order: { createdAt: "DESC" },
    })
    if (campaign) {
      logger.log(`Reusing active campaign ${campaign.name} (${campaign.id})`)
    } else {
      campaign = await campaignRepo.save(
        campaignRepo.create({
          organizationId: firstProject.organizationId,
          projectId: firstProject.id,
          agentId: agent.id,
          name: `Dev test campaign (${new Date().toISOString().slice(0, 10)})`,
          description: "Seeded by seed:review-campaign-tester for local iteration.",
          status: "active",
          testerPerSessionQuestions: [
            { id: "ps-1", prompt: "Was the agent's answer clear?", type: "rating", required: true },
            {
              id: "ps-2",
              prompt: "Did the agent address your question?",
              type: "single-choice",
              required: true,
              options: ["Yes", "Partially", "No"],
            },
          ],
          testerEndOfPhaseQuestions: [
            {
              id: "eop-1",
              prompt: "Overall satisfaction with this agent?",
              type: "rating",
              required: true,
            },
          ],
          reviewerQuestions: [
            {
              id: "rv-1",
              prompt: "Were the agent's answers factually correct?",
              type: "rating",
              required: true,
            },
          ],
          activatedAt: new Date(),
          closedAt: null,
        }),
      )
      logger.log(`Created campaign ${campaign.name} (${campaign.id})`)
    }

    const existingMembership = await membershipRepo.findOne({
      where: { campaignId: campaign.id, userId: user.id, role: "tester" },
    })
    if (existingMembership) {
      if (!existingMembership.acceptedAt) {
        existingMembership.acceptedAt = new Date()
        await membershipRepo.save(existingMembership)
        logger.log(`Marked existing tester membership accepted`)
      } else {
        logger.log(`Tester membership already accepted`)
      }
    } else {
      await membershipRepo.save(
        membershipRepo.create({
          organizationId: firstProject.organizationId,
          projectId: firstProject.id,
          campaignId: campaign.id,
          userId: user.id,
          role: "tester",
          acceptedAt: new Date(),
        }),
      )
      logger.log(`Created accepted tester membership for ${email}`)
    }

    const testerUrl = `/tester/o/${firstProject.organizationId}/p/${firstProject.id}/review-campaigns/${campaign.id}`
    logger.log("")
    logger.log(`Done. Open the tester landing at:`)
    logger.log(`  ${testerUrl}`)
    logger.log(`Or visit /tester to see it in "My review campaigns".`)
  } finally {
    await app.close()
  }
}

void main()
