import { randomUUID } from "node:crypto"
import type { Repository } from "typeorm"
import { grantUserRole } from "@/common/test/grant-user-role"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { Agent } from "@/domains/agents/agent.entity"
import { agentFactory } from "@/domains/agents/agent.factory"
import { Organization } from "@/domains/organizations/organization.entity"
import { organizationFactory } from "@/domains/organizations/organization.factory"
import { Project } from "@/domains/projects/project.entity"
import { projectFactory } from "@/domains/projects/project.factory"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import type { User } from "@/domains/users/user.entity"
import { userFactory } from "@/domains/users/user.factory"
import { ALL_RBAC_ROLES } from "./rbac.constants"
import { RbacModule } from "./rbac.module"
import { RbacService } from "./rbac.service"
import { Role } from "./role.entity"
import { UserRole } from "./user-role.entity"

describe("RbacService", () => {
  let service: RbacService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let roleRepo: Repository<Role>
  let userRoleRepo: Repository<UserRole>
  let userRepo: Repository<User>
  let orgRepo: Repository<Organization>
  let projectRepo: Repository<Project>
  let agentRepo: Repository<Agent>
  let campaignRepo: Repository<ReviewCampaign>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: [RbacModule] })
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    service = setup.module.get<RbacService>(RbacService)
    repositories = setup.getAllRepositories()
    roleRepo = setup.getRepository(Role)
    userRoleRepo = setup.getRepository(UserRole)
    userRepo = repositories.userRepository
    orgRepo = setup.getRepository(Organization)
    projectRepo = setup.getRepository(Project)
    agentRepo = setup.getRepository(Agent)
    campaignRepo = setup.getRepository(ReviewCampaign)
  })

  const createUser = async () => userRepo.save(userFactory.build())
  const createOrg = async () => orgRepo.save(organizationFactory.build())
  const createProject = async (org: Organization) =>
    projectRepo.save(projectFactory.transient({ organization: org }).build())
  const createAgent = async (organization: Organization, project: Project) =>
    agentRepo.save(agentFactory.transient({ organization, project }).build())
  const createCampaign = async (organization: Organization, project: Project, agent: Agent) =>
    campaignRepo.save(reviewCampaignFactory.transient({ organization, project, agent }).build())

  describe("organizationRole", () => {
    it("returns null when the user has no membership", async () => {
      const user = await createUser()
      const org = await createOrg()
      expect(await service.organizationRole(user.id, org.id)).toBeNull()
    })

    it("returns the role for a matching membership", async () => {
      const user = await createUser()
      const org = await createOrg()
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "org_owner",
        conditions: { organizationId: org.id },
      })
      expect(await service.organizationRole(user.id, org.id)).toBe("owner")
    })

    it("isolates roles per organization", async () => {
      const user = await createUser()
      const orgA = await createOrg()
      const orgB = await createOrg()
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "org_owner",
        conditions: { organizationId: orgA.id },
      })
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "org_member",
        conditions: { organizationId: orgB.id },
      })
      expect(await service.organizationRole(user.id, orgA.id)).toBe("owner")
      expect(await service.organizationRole(user.id, orgB.id)).toBe("member")
    })

    it("ignores soft-deleted grants", async () => {
      const user = await createUser()
      const org = await createOrg()
      const grant = await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "org_owner",
        conditions: { organizationId: org.id },
      })
      await userRoleRepo.softRemove(grant)
      expect(await service.organizationRole(user.id, org.id)).toBeNull()
    })
  })

  describe("projectRole", () => {
    it("returns the matching role for the project", async () => {
      const user = await createUser()
      const org = await createOrg()
      const project = await createProject(org)
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "project_admin",
        conditions: { organizationId: org.id, projectId: project.id },
      })
      expect(await service.projectRole(user.id, project.id)).toBe("admin")
    })

    it("returns null when the user is only an org member, not a project member", async () => {
      const user = await createUser()
      const org = await createOrg()
      const project = await createProject(org)
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "org_admin",
        conditions: { organizationId: org.id },
      })
      expect(await service.projectRole(user.id, project.id)).toBeNull()
    })
  })

  describe("agentRole", () => {
    it("returns the agent-specific role and ignores agents the user has no grant on", async () => {
      const user = await createUser()
      const org = await createOrg()
      const project = await createProject(org)
      const agentA = await createAgent(org, project)
      const agentB = await createAgent(org, project)
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "agent_member",
        conditions: { organizationId: org.id, projectId: project.id, agentId: agentA.id },
      })
      expect(await service.agentRole(user.id, agentA.id)).toBe("member")
      expect(await service.agentRole(user.id, agentB.id)).toBeNull()
    })
  })

  describe("campaignRoles", () => {
    const grantCampaignRole = async (
      userId: string,
      campaign: ReviewCampaign,
      role: "tester" | "reviewer",
    ) =>
      grantUserRole({
        repositories,
        userId,
        roleName: `campaign_${role}`,
        conditions: {
          organizationId: campaign.organizationId,
          projectId: campaign.projectId,
          campaignId: campaign.id,
        },
      })

    const buildContext = async () => {
      const user = await createUser()
      const org = await createOrg()
      const project = await createProject(org)
      const agent = await createAgent(org, project)
      const campaign = await createCampaign(org, project, agent)
      return { user, org, project, agent, campaign }
    }

    it("returns tester:true / reviewer:false when only tester is granted", async () => {
      const { user, campaign } = await buildContext()
      await grantCampaignRole(user.id, campaign, "tester")
      expect(await service.campaignRoles(user.id, campaign.id)).toEqual({
        tester: true,
        reviewer: false,
      })
    })

    it("returns both flags when a user holds both roles on the same campaign", async () => {
      const { user, campaign } = await buildContext()
      await grantCampaignRole(user.id, campaign, "tester")
      await grantCampaignRole(user.id, campaign, "reviewer")
      expect(await service.campaignRoles(user.id, campaign.id)).toEqual({
        tester: true,
        reviewer: true,
      })
    })

    it("returns no flags when the grant belongs to a different campaign", async () => {
      const { user, campaign } = await buildContext()
      await grantCampaignRole(user.id, campaign, "reviewer")
      expect(await service.campaignRoles(user.id, randomUUID())).toEqual({
        tester: false,
        reviewer: false,
      })
    })
  })

  describe("loadUserGrants", () => {
    it("filters rows whose role name is outside the catalog", async () => {
      const user = await createUser()
      const known = await roleRepo.findOneByOrFail({ name: "org_admin" })
      // Randomized name — the role catalog survives across `clearTestDatabase`
      // calls now (seeded once per module), so a static name collides on rerun.
      const unknown = await roleRepo.save(
        roleRepo.create({
          name: `legacy_made_up_role_${randomUUID()}`,
          description: null,
          isSystem: true,
        }),
      )
      await userRoleRepo.save([
        userRoleRepo.create({
          userId: user.id,
          roleId: known.id,
          conditions: { organizationId: randomUUID() },
        }),
        userRoleRepo.create({ userId: user.id, roleId: unknown.id, conditions: null }),
      ])

      const grants = await service.loadUserGrants(user.id)
      expect(grants).toHaveLength(1)
      expect(grants[0]?.roleName).toBe("org_admin")
    })

    it("exposes every catalog role", () => {
      expect(ALL_RBAC_ROLES.length).toBe(11)
    })
  })
})
