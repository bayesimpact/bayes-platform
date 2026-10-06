import { randomUUID } from "node:crypto"
import {
  AppsDocumentTagsRoutes,
  DOCUMENT_READ_PERMISSION,
  DOCUMENT_TAG_CREATE_PERMISSION,
  DOCUMENT_TAG_DELETE_PERMISSION,
  DOCUMENT_TAG_READ_PERMISSION,
  DOCUMENT_TAG_UPDATE_PERMISSION,
  PUBLIC_DOCUMENTS_TAG_NAME,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import request from "supertest"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { DocumentTag } from "@/domains/documents/tags/document-tag.entity"
import { documentTagFactory } from "@/domains/documents/tags/document-tag.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { assignPlatformStaffToUser, ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../test/request"
import { AppsModule } from "../apps.module"
import { AppsService } from "../apps.service"

const ALL_TAG_PERMISSIONS = [
  DOCUMENT_TAG_READ_PERMISSION,
  DOCUMENT_TAG_CREATE_PERMISSION,
  DOCUMENT_TAG_UPDATE_PERMISSION,
  DOCUMENT_TAG_DELETE_PERMISSION,
] as const

describe("Apps - Document tags", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AppsModule, RbacModule, ActivitiesModule],
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const installAndIssueToken = async (permissions: readonly string[]) => {
    const appsService = setup.module.get(AppsService)
    const { organization, project, user } = await createOrganizationWithProject(repositories)
    await assignPlatformStaffToUser({ repositories, user })
    const slug = `tags-${randomUUID().slice(0, 8)}`
    await appsService.createAppManifest({
      name: "Helpful Assistant",
      slug,
      description: null,
      logoUrl: null,
      grantablePermissions: [...ALL_TAG_PERMISSIONS],
    })
    const credentials = await appsService.authorizeInstall({
      slug,
      userId: user.id,
      projectId: project.id,
      permissions,
      redirectUri: "http://127.0.0.1:8787/callback",
      state: "csrf-state",
    })
    const token = await appsService.issueToken({
      grant_type: "client_credentials",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    })
    return { organization, project, accessToken: token.accessToken }
  }

  const call = (params: {
    method: "get" | "post" | "patch" | "delete"
    path: string
    token?: string
    body?: Record<string, unknown>
  }) => {
    const http = request(app.getHttpServer())
    const req = http[params.method](params.path).set("Connection", "close")
    if (params.token) req.set("Authorization", `Bearer ${params.token}`)
    if (params.body) req.send(params.body)
    return req
  }

  it("creates, lists, updates, and deletes a tag", async () => {
    const { organization, project, accessToken } = await installAndIssueToken(ALL_TAG_PERMISSIONS)
    const created = await call({
      method: "post",
      path: AppsDocumentTagsRoutes.createOne.getPath({ projectId: project.id }),
      token: accessToken,
      body: { name: "Pricing", description: "Product pricing", parent_id: null },
    })
    expectResponse(created, 201)
    expect(created.body.data).toMatchObject({
      name: "Pricing",
      description: "Product pricing",
      parentId: null,
    })
    expect(typeof created.body.data.createdAt).toBe("number")

    const tagId = created.body.data.id as string
    const child = await call({
      method: "post",
      path: AppsDocumentTagsRoutes.createOne.getPath({ projectId: project.id }),
      token: accessToken,
      body: { name: "Plans", parent_id: tagId },
    })
    expectResponse(child, 201)
    expect(child.body.data.parentId).toBe(tagId)

    const listed = await call({
      method: "get",
      path: AppsDocumentTagsRoutes.getAll.getPath({ projectId: project.id }),
      token: accessToken,
    })
    expectResponse(listed, 200)
    expect(listed.body.data.map((documentTag: { name: string }) => documentTag.name)).toEqual([
      "Plans",
      "Pricing",
    ])

    const fetched = await call({
      method: "get",
      path: AppsDocumentTagsRoutes.getOne.getPath({ projectId: project.id, id: tagId }),
      token: accessToken,
    })
    expectResponse(fetched, 200)
    expect(fetched.body.data.name).toBe("Pricing")

    const updated = await call({
      method: "patch",
      path: AppsDocumentTagsRoutes.updateOne.getPath({ projectId: project.id, id: tagId }),
      token: accessToken,
      body: { name: "Billing", description: null },
    })
    expectResponse(updated, 200)
    expect(updated.body.data).toMatchObject({ name: "Billing", description: null, parentId: null })

    const removed = await call({
      method: "delete",
      path: AppsDocumentTagsRoutes.deleteOne.getPath({ projectId: project.id, id: tagId }),
      token: accessToken,
    })
    expectResponse(removed, 200)
    expect(removed.body.data).toEqual({ success: true })
    expect(await setup.getRepository(DocumentTag).findOne({ where: { id: tagId } })).toBeNull()

    await expectActivityCreated("apps.documentTag.create", {
      organizationId: organization.id,
      projectId: project.id,
      entityId: null,
      entityType: null,
    })
    await expectActivityCreated("apps.documentTag.update", {
      organizationId: organization.id,
      projectId: project.id,
      entityId: tagId,
      entityType: "documentTag",
    })
    await expectActivityCreated("apps.documentTag.delete", {
      organizationId: organization.id,
      projectId: project.id,
      entityId: tagId,
      entityType: "documentTag",
    })
  })

  it("rejects the reserved public-documents name and a child of that tag", async () => {
    const { organization, project, accessToken } = await installAndIssueToken(ALL_TAG_PERMISSIONS)
    expectResponse(
      await call({
        method: "post",
        path: AppsDocumentTagsRoutes.createOne.getPath({ projectId: project.id }),
        token: accessToken,
        body: { name: "Public-Documents" },
      }),
      400,
      `Tag name "${PUBLIC_DOCUMENTS_TAG_NAME}" is reserved.`,
    )

    const publicDocumentsTag = await setup.getRepository(DocumentTag).save(
      documentTagFactory.transient({ organization, project }).build({
        name: PUBLIC_DOCUMENTS_TAG_NAME,
      }),
    )
    expectResponse(
      await call({
        method: "post",
        path: AppsDocumentTagsRoutes.createOne.getPath({ projectId: project.id }),
        token: accessToken,
        body: { name: "Published", parent_id: publicDocumentsTag.id },
      }),
      400,
      `Tag "${PUBLIC_DOCUMENTS_TAG_NAME}" cannot have children.`,
    )
    expectResponse(
      await call({
        method: "patch",
        path: AppsDocumentTagsRoutes.updateOne.getPath({
          projectId: project.id,
          id: publicDocumentsTag.id,
        }),
        token: accessToken,
        body: { name: "Renamed" },
      }),
      400,
      `Tag "${PUBLIC_DOCUMENTS_TAG_NAME}" cannot be edited.`,
    )
    expectResponse(
      await call({
        method: "delete",
        path: AppsDocumentTagsRoutes.deleteOne.getPath({
          projectId: project.id,
          id: publicDocumentsTag.id,
        }),
        token: accessToken,
      }),
      400,
      `Tag "${PUBLIC_DOCUMENTS_TAG_NAME}" cannot be deleted.`,
    )
  })

  it("rejects a parent from another project of the same organization", async () => {
    const { organization, project, accessToken } = await installAndIssueToken(ALL_TAG_PERMISSIONS)
    const otherProject = projectFactory.transient({ organization }).build()
    await repositories.projectRepository.save(otherProject)
    const foreignTag = await setup
      .getRepository(DocumentTag)
      .save(
        documentTagFactory
          .transient({ organization, project: otherProject })
          .build({ name: "Other project" }),
      )

    expectResponse(
      await call({
        method: "post",
        path: AppsDocumentTagsRoutes.createOne.getPath({ projectId: project.id }),
        token: accessToken,
        body: { name: "Child", parent_id: foreignTag.id },
      }),
      404,
      `DocumentTag with id ${foreignTag.id} not found`,
    )
    expect(
      await setup
        .getRepository(DocumentTag)
        .findOne({ where: { name: "Child", projectId: project.id } }),
    ).toBeNull()
  })

  it("rejects a parent from another organization", async () => {
    const { project, accessToken } = await installAndIssueToken(ALL_TAG_PERMISSIONS)
    const other = await createOrganizationWithProject(repositories)
    const foreignTag = await setup
      .getRepository(DocumentTag)
      .save(
        documentTagFactory
          .transient({ organization: other.organization, project: other.project })
          .build({ name: "Other organization" }),
      )

    expectResponse(
      await call({
        method: "post",
        path: AppsDocumentTagsRoutes.createOne.getPath({ projectId: project.id }),
        token: accessToken,
        body: { name: "Child", parent_id: foreignTag.id },
      }),
      404,
      `DocumentTag with id ${foreignTag.id} not found`,
    )
  })

  it("rejects a tag as its own parent", async () => {
    const { project, accessToken } = await installAndIssueToken(ALL_TAG_PERMISSIONS)
    const created = await call({
      method: "post",
      path: AppsDocumentTagsRoutes.createOne.getPath({ projectId: project.id }),
      token: accessToken,
      body: { name: "Pricing" },
    })
    expectResponse(created, 201)
    const tagId = created.body.data.id as string

    expectResponse(
      await call({
        method: "patch",
        path: AppsDocumentTagsRoutes.updateOne.getPath({ projectId: project.id, id: tagId }),
        token: accessToken,
        body: { parent_id: tagId },
      }),
      400,
      "A tag cannot be its own parent.",
    )
    expect(
      (await setup.getRepository(DocumentTag).findOne({ where: { id: tagId } }))?.parentId,
    ).toBe(null)
  })

  it("hides a tag that belongs to another project", async () => {
    const caller = await installAndIssueToken(ALL_TAG_PERMISSIONS)
    const other = await installAndIssueToken(ALL_TAG_PERMISSIONS)
    const created = await call({
      method: "post",
      path: AppsDocumentTagsRoutes.createOne.getPath({ projectId: other.project.id }),
      token: other.accessToken,
      body: { name: "Other tag" },
    })
    const tagId = created.body.data.id as string

    expectResponse(
      await call({
        method: "get",
        path: AppsDocumentTagsRoutes.getOne.getPath({
          projectId: other.project.id,
          id: tagId,
        }),
        token: caller.accessToken,
      }),
      403,
      AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
    )
    expectResponse(
      await call({
        method: "get",
        path: AppsDocumentTagsRoutes.getOne.getPath({
          projectId: caller.project.id,
          id: tagId,
        }),
        token: caller.accessToken,
      }),
      404,
      `Document tag ${tagId} not found`,
    )
  })

  it("returns 403 without document_tag.create and 401 without a token", async () => {
    const { project, accessToken } = await installAndIssueToken([DOCUMENT_TAG_READ_PERMISSION])
    expectResponse(
      await call({
        method: "post",
        path: AppsDocumentTagsRoutes.createOne.getPath({ projectId: project.id }),
        token: accessToken,
        body: { name: "Pricing" },
      }),
      403,
      AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
    )
    expectResponse(
      await call({
        method: "get",
        path: AppsDocumentTagsRoutes.getAll.getPath({ projectId: project.id }),
      }),
      401,
      AUTH_ERRORS.NO_ACCESS_TOKEN,
    )
  })

  it("rejects an invalid tag payload", async () => {
    const { project, accessToken } = await installAndIssueToken(ALL_TAG_PERMISSIONS)
    expectResponse(
      await call({
        method: "post",
        path: AppsDocumentTagsRoutes.createOne.getPath({ projectId: project.id }),
        token: accessToken,
        body: { name: "" },
      }),
      400,
      "Invalid document tag payload",
    )
  })

  it("does not accept document.read in place of document_tag.read", async () => {
    const appsService = setup.module.get(AppsService)
    const { project, user } = await createOrganizationWithProject(repositories)
    await assignPlatformStaffToUser({ repositories, user })
    const slug = `docs-only-${randomUUID().slice(0, 8)}`
    await appsService.createAppManifest({
      name: "Helpful Assistant",
      slug,
      description: null,
      logoUrl: null,
      grantablePermissions: [DOCUMENT_READ_PERMISSION],
    })
    const credentials = await appsService.authorizeInstall({
      slug,
      userId: user.id,
      projectId: project.id,
      permissions: [DOCUMENT_READ_PERMISSION],
      redirectUri: "http://127.0.0.1:8787/callback",
      state: "csrf-state",
    })
    const token = await appsService.issueToken({
      grant_type: "client_credentials",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    })

    expectResponse(
      await call({
        method: "get",
        path: AppsDocumentTagsRoutes.getAll.getPath({ projectId: project.id }),
        token: token.accessToken,
      }),
      403,
      AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
    )
  })
})
