import { randomUUID } from "node:crypto"
import { EvalMyInvitationsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse } from "../../../../../test/request"
import { type SchemaRequester, testSchemaRequester } from "../../../../../test/schema-request"
import { EvalModule } from "../../eval.module"

describe("Evaluation invitations - Auth", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => "oidc|123"),
    })
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  it("requires an authentication token on every route", async () => {
    const pathParams = { invitationId: randomUUID() }
    expectResponse(
      await request({ route: EvalMyInvitationsRoutes.getMine }),
      401,
      AUTH_ERRORS.NO_ACCESS_TOKEN,
    )
    expectResponse(
      await request({ route: EvalMyInvitationsRoutes.acceptOne, pathParams }),
      401,
      AUTH_ERRORS.NO_ACCESS_TOKEN,
    )
    expectResponse(
      await request({ route: EvalMyInvitationsRoutes.declineOne, pathParams }),
      401,
      AUTH_ERRORS.NO_ACCESS_TOKEN,
    )
  })
})
