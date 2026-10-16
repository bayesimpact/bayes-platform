import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "@/app.module"
import { RbacService } from "@/domains/rbac/rbac.service"
import { confirmDatabaseTarget } from "@/scripts/script-bootstrap"

const logger = new Logger("SeedRbac")

async function main(): Promise<void> {
  await confirmDatabaseTarget(logger)

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  })

  try {
    const rbacService = app.get(RbacService)
    await rbacService.seedOrganizationRolesAndPermissions()
    await rbacService.seedProjectRolesAndPermissions()
    await rbacService.seedAgentRolesAndPermissions()
    await rbacService.seedReviewCampaignRolesAndPermissions()
    const updatedOrganizationCount = await rbacService.assignRoleIdsToOrganizationMemberships()
    const updatedProjectCount = await rbacService.assignRoleIdsToProjectMemberships()
    const updatedAgentCount = await rbacService.assignRoleIdsToAgentMemberships()
    const updatedReviewCampaignCount = await rbacService.assignRoleIdsToReviewCampaignMemberships()
    logger.log(`Assigned role_id on ${updatedOrganizationCount} organization membership(s)`)
    logger.log(`Assigned role_id on ${updatedProjectCount} project membership(s)`)
    logger.log(`Assigned role_id on ${updatedAgentCount} agent membership(s)`)
    logger.log(`Assigned role_id on ${updatedReviewCampaignCount} review campaign membership(s)`)
  } finally {
    await app.close()
  }
}

void main()
