import { subject } from "@casl/ability"
import { grantUserRole } from "@/common/test/grant-user-role"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { Organization } from "@/domains/organizations/organization.entity"
import { organizationFactory } from "@/domains/organizations/organization.factory"
import { Project } from "@/domains/projects/project.entity"
import { projectFactory } from "@/domains/projects/project.factory"
import { userFactory } from "@/domains/users/user.factory"
import { AbilityFactory } from "./ability.factory"
import { RbacModule } from "./rbac.module"

/**
 * Validates that `AbilityFactory.forUser` produces an `AppAbility` whose
 * `can`/`cannot` checks match the policy layer's truth tables. Each test
 * seeds a `user_role` grant via `grantUserRole`, builds the ability, and
 * exercises a representative (action, subject) check.
 *
 * The Phase-3 permission catalog is reseeded by `clearTestDatabase` (see
 * `seedRbacCatalog` import there), so each `beforeEach` starts with the
 * full catalog and the 11 roles installed.
 */
describe("AbilityFactory", () => {
  let factory: AbilityFactory
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: [RbacModule] })
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    factory = setup.module.get<AbilityFactory>(AbilityFactory)
    repositories = setup.getAllRepositories()
  })

  const createUser = async (overrides: Partial<{ email: string }> = {}) =>
    repositories.userRepository.save(userFactory.build(overrides))
  const createOrg = async () => setup.getRepository(Organization).save(organizationFactory.build())
  const createProject = async (org: Organization) =>
    setup.getRepository(Project).save(projectFactory.transient({ organization: org }).build())

  describe("Project subject (pilot)", () => {
    it("org_owner can list Project in their org", async () => {
      const user = await createUser()
      const org = await createOrg()
      const project = await createProject(org)
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "org_owner",
        conditions: { organizationId: org.id },
      })

      const ability = await factory.forUser({ id: user.id, email: user.email })

      expect(ability.can("list", subject("Project", project))).toBe(true)
    })

    it("org_owner cannot list Project in a different org", async () => {
      const user = await createUser()
      const ownOrg = await createOrg()
      const otherOrg = await createOrg()
      const otherProject = await createProject(otherOrg)
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "org_owner",
        conditions: { organizationId: ownOrg.id },
      })

      const ability = await factory.forUser({ id: user.id, email: user.email })

      expect(ability.can("list", subject("Project", otherProject))).toBe(false)
    })

    it("org_member cannot create Project", async () => {
      const user = await createUser()
      const org = await createOrg()
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "org_member",
        conditions: { organizationId: org.id },
      })

      const ability = await factory.forUser({ id: user.id, email: user.email })

      expect(ability.can("create", "Project")).toBe(false)
    })

    it("org_admin can create Project", async () => {
      const user = await createUser()
      const org = await createOrg()
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "org_admin",
        conditions: { organizationId: org.id },
      })

      const ability = await factory.forUser({ id: user.id, email: user.email })

      expect(ability.can("create", "Project")).toBe(true)
    })

    it("project_owner can update their own Project, not another", async () => {
      const user = await createUser()
      const org = await createOrg()
      const ownProject = await createProject(org)
      const otherProject = await createProject(org)
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "project_owner",
        conditions: { organizationId: org.id, projectId: ownProject.id },
      })

      const ability = await factory.forUser({ id: user.id, email: user.email })

      expect(ability.can("update", subject("Project", ownProject))).toBe(true)
      expect(ability.can("update", subject("Project", otherProject))).toBe(false)
    })

    it("project_member cannot update Project", async () => {
      const user = await createUser()
      const org = await createOrg()
      const project = await createProject(org)
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "project_member",
        conditions: { organizationId: org.id, projectId: project.id },
      })

      const ability = await factory.forUser({ id: user.id, email: user.email })

      expect(ability.can("update", subject("Project", project))).toBe(false)
    })

    it("returns an empty ability for a user with no grants", async () => {
      const user = await createUser()
      const org = await createOrg()
      const project = await createProject(org)

      const ability = await factory.forUser({ id: user.id, email: user.email })

      expect(ability.can("list", subject("Project", project))).toBe(false)
      expect(ability.can("update", subject("Project", project))).toBe(false)
    })
  })

  describe("Document subject — sourceType conditional", () => {
    it("project_member can create Document with sourceType=agentSessionMessage", async () => {
      const user = await createUser()
      const org = await createOrg()
      const project = await createProject(org)
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "project_member",
        conditions: { organizationId: org.id, projectId: project.id },
      })

      const ability = await factory.forUser({ id: user.id, email: user.email })

      expect(
        ability.can(
          "create",
          subject("Document", {
            projectId: project.id,
            organizationId: org.id,
            sourceType: "agentSessionMessage",
          }),
        ),
      ).toBe(true)
    })

    it("project_member cannot create Document with sourceType=manual", async () => {
      const user = await createUser()
      const org = await createOrg()
      const project = await createProject(org)
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "project_member",
        conditions: { organizationId: org.id, projectId: project.id },
      })

      const ability = await factory.forUser({ id: user.id, email: user.email })

      expect(
        ability.can(
          "create",
          subject("Document", {
            projectId: project.id,
            organizationId: org.id,
            sourceType: "manual",
          }),
        ),
      ).toBe(false)
    })

    it("project_admin can create Document with any sourceType", async () => {
      const user = await createUser()
      const org = await createOrg()
      const project = await createProject(org)
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "project_admin",
        conditions: { organizationId: org.id, projectId: project.id },
      })

      const ability = await factory.forUser({ id: user.id, email: user.email })

      expect(
        ability.can(
          "create",
          subject("Document", {
            projectId: project.id,
            organizationId: org.id,
            sourceType: "manual",
          }),
        ),
      ).toBe(true)
    })
  })

  describe("Reviewer / Tester — status-gated rules", () => {
    it("campaign_reviewer.read.Reviewer is allowed on active campaigns", async () => {
      const user = await createUser()
      const org = await createOrg()
      const project = await createProject(org)
      const campaignId = "00000000-0000-0000-0000-000000000aaa"
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "campaign_reviewer",
        conditions: { organizationId: org.id, projectId: project.id, campaignId },
      })

      const ability = await factory.forUser({ id: user.id, email: user.email })

      expect(ability.can("read", subject("Reviewer", { id: campaignId, status: "active" }))).toBe(
        true,
      )
    })

    it("campaign_reviewer.read.Reviewer is denied on draft campaigns", async () => {
      const user = await createUser()
      const org = await createOrg()
      const project = await createProject(org)
      const campaignId = "00000000-0000-0000-0000-000000000bbb"
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "campaign_reviewer",
        conditions: { organizationId: org.id, projectId: project.id, campaignId },
      })

      const ability = await factory.forUser({ id: user.id, email: user.email })

      expect(ability.can("read", subject("Reviewer", { id: campaignId, status: "draft" }))).toBe(
        false,
      )
    })

    it("campaign_reviewer.review.Reviewer is denied on closed campaigns (requires status=active)", async () => {
      const user = await createUser()
      const org = await createOrg()
      const project = await createProject(org)
      const campaignId = "00000000-0000-0000-0000-000000000ccc"
      await grantUserRole({
        repositories,
        userId: user.id,
        roleName: "campaign_reviewer",
        conditions: { organizationId: org.id, projectId: project.id, campaignId },
      })

      const ability = await factory.forUser({ id: user.id, email: user.email })

      expect(ability.can("review", subject("Reviewer", { id: campaignId, status: "closed" }))).toBe(
        false,
      )
    })
  })

  describe("Organization.create env-domain rule", () => {
    afterEach(() => {
      delete process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN
    })

    it("permits create when user.email matches the configured domain", async () => {
      process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN = "example.org"
      const user = await createUser({ email: "alice@example.org" })

      const ability = await factory.forUser({ id: user.id, email: user.email })

      expect(ability.can("create", "Organization")).toBe(true)
    })

    it("denies create when email domain does not match", async () => {
      process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN = "example.org"
      const user = await createUser({ email: "alice@other.com" })

      const ability = await factory.forUser({ id: user.id, email: user.email })

      expect(ability.can("create", "Organization")).toBe(false)
    })

    it("denies create when env var is unset", async () => {
      const user = await createUser({ email: "alice@example.org" })

      const ability = await factory.forUser({ id: user.id, email: user.email })

      expect(ability.can("create", "Organization")).toBe(false)
    })
  })
})
