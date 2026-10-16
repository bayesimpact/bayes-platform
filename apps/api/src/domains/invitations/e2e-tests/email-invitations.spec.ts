import { randomUUID } from "node:crypto"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import type { MailMessage } from "@/common/mailer/mailer.service"
import { MailerService } from "@/common/mailer/mailer.service"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { InvitationsModule } from "../invitations.module"
import { invitationRoutesFor } from "./invitation-routes.helpers"

describe("Invitations - email", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let authSubject = `oidc|${randomUUID()}`
  const sentMessages: MailMessage[] = []
  const fakeMailer = {
    enabled: true,
    failing: false,
    isEnabled: () => fakeMailer.enabled,
    send: async (message: MailMessage) => {
      if (fakeMailer.failing) throw new Error("SMTP server refused the message")
      sentMessages.push(message)
    },
  }
  const previousAppPublicUrl = process.env.APP_PUBLIC_URL

  beforeAll(async () => {
    process.env.APP_PUBLIC_URL = "https://platform.example.org"
    setup = await setupE2eTestDatabase({
      additionalImports: [InvitationsModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(MailerService)
          .useValue(fakeMailer),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = `oidc|${randomUUID()}`
    sentMessages.length = 0
    fakeMailer.enabled = true
    fakeMailer.failing = false
  })

  afterAll(async () => {
    process.env.APP_PUBLIC_URL = previousAppPublicUrl
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const invite = async (emails: string[]) => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { authSubject, name: "Alex Martin" },
    })
    const { routes, pathParams } = invitationRoutesFor({ project })
    const response = await request({
      route: routes.createMany,
      pathParams,
      token: "token",
      request: { payload: { emails } },
    })
    return { response, organization, project }
  }

  it("emails each new invitation with its link", async () => {
    const { response, organization, project } = await invite(["first+team@example.com"])

    expectResponse(response, 201)
    expect(response.body.data.emailSent).toBe(true)
    expect(sentMessages).toHaveLength(1)
    const [message] = sentMessages
    expect(message?.to).toBe("first+team@example.com")
    expect(message?.subject).toContain(project.name)
    expect(message?.text).toContain(
      `Alex Martin invited you to join the workspace ${project.name} (${organization.name}).`,
    )
    expect(message?.text).toContain(
      "https://platform.example.org/?login_hint=first%2Bteam%40example.com",
    )
  })

  it("does not email people who were skipped", async () => {
    const { response, project } = await invite(["twice@example.com"])
    expectResponse(response, 201)
    sentMessages.length = 0

    const { routes, pathParams } = invitationRoutesFor({ project })
    const again = await request({
      route: routes.createMany,
      pathParams,
      token: "token",
      request: { payload: { emails: ["twice@example.com"] } },
    })

    expectResponse(again, 201)
    expect(again.body.data).toEqual({ invitations: [], emailSent: false })
    expect(sentMessages).toEqual([])
  })

  it("keeps the invitations when an email fails", async () => {
    fakeMailer.failing = true

    const { response } = await invite(["invited@example.com"])

    expectResponse(response, 201)
    expect(response.body.data.invitations).toHaveLength(1)
    expect(response.body.data.emailSent).toBe(false)
  })

  it("sends nothing without SMTP", async () => {
    fakeMailer.enabled = false

    const { response } = await invite(["invited@example.com"])

    expectResponse(response, 201)
    expect(response.body.data.invitations).toHaveLength(1)
    expect(response.body.data.emailSent).toBe(false)
    expect(sentMessages).toEqual([])
  })
})
