import { randomUUID } from "node:crypto"
import { DeskDocumentsRoutes } from "@bayes-platform/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithDocument } from "@/domains/organizations/organization.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import { projectFactory } from "@/domains/projects/project.factory"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import { type SchemaRequester, testSchemaRequester } from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

type DocumentRouteName = "getIsPublic" | "getTemporaryUrl"

const DOCUMENT_ROUTE_NAMES: DocumentRouteName[] = ["getIsPublic", "getTemporaryUrl"]

describe("Desk documents - Auth", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let documentId: string = randomUUID()
  let accessToken: string | undefined = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    organizationId = randomUUID()
    projectId = randomUUID()
    documentId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContextForRole = async (role: ProjectRoleKey) => {
    const created = await createOrganizationWithDocument(repositories, {
      user: { authSubject },
      projectMembership: { roleKeys: [role] },
    })
    organizationId = created.organization.id
    projectId = created.project.id
    documentId = created.document.id
    return { organization: created.organization }
  }

  const switchToOrganizationAdminWithoutProjectRole = async ({
    organization,
  }: Awaited<ReturnType<typeof createContextForRole>>) => {
    const organizationAdminAuthSubject = `oidc|${randomUUID()}`
    await addUserToOrganization({
      repositories,
      organization,
      user: {
        authSubject: organizationAdminAuthSubject,
        email: mockOidcEmailForSub(organizationAdminAuthSubject),
      },
      membership: { roleKeys: ["org_admin"] },
    })
    authSubject = organizationAdminAuthSubject
  }

  const subjects: Record<DocumentRouteName, () => ReturnType<SchemaRequester>> = {
    getIsPublic: () =>
      request({
        route: DeskDocumentsRoutes.getIsPublic,
        pathParams: { organizationId, projectId, documentId },
        token: accessToken,
      }),
    getTemporaryUrl: () =>
      request({
        route: DeskDocumentsRoutes.getTemporaryUrl,
        pathParams: { organizationId, projectId, documentId },
        token: accessToken,
      }),
  }

  const allowedStatus: Record<DocumentRouteName, number> = {
    getIsPublic: 200,
    getTemporaryUrl: 201,
  }

  describe.each(DOCUMENT_ROUTE_NAMES)("%s", (routeName) => {
    const subject = () => subjects[routeName]()

    it("requires an authentication token", async () => {
      accessToken = undefined
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("answers 400 for ids that are not UUIDs", async () => {
      await createContextForRole("project_owner")
      documentId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 404 for an unknown project", async () => {
      await createContextForRole("project_owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("answers 404 for an unknown document", async () => {
      await createContextForRole("project_owner")
      documentId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("answers 404 for a document of another project", async () => {
      const { organization } = await createContextForRole("project_owner")
      const otherProject = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      projectId = otherProject.id
      expectResponse(await subject(), 404)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("project_owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it.each<ProjectRoleKey>(["project_owner", "project_admin"])("allows a %s", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), allowedStatus[routeName])
    })
  })

  // A simple member holds `project.read` only: the public check passes, the download needs
  // `document.read` unless the document is public.
  it("lets a project member ask whether a document is public", async () => {
    await createContextForRole("project_member")
    expectResponse(await subjects.getIsPublic(), 200)
  })

  it("forbids a project member from downloading a document that is not public", async () => {
    await createContextForRole("project_member")
    expectResponse(await subjects.getTemporaryUrl(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })
})
