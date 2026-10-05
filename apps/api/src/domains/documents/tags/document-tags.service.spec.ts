import { PUBLIC_DOCUMENTS_TAG_NAME } from "@caseai-connect/api-contracts"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { createDocumentForProject } from "@/domains/documents/document.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { DocumentTagsModule } from "./document-tags.module"
import { DocumentTagsService } from "./document-tags.service"

describe("DocumentTagsService", () => {
  let service: DocumentTagsService
  let repositories: AllRepositories
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DocumentTagsModule],
    })
    service = setup.module.get(DocumentTagsService)
    repositories = setup.getAllRepositories()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  it("creates a tag and lists tags sorted by name", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }

    await service.createDocumentTag({
      connectScope,
      fields: { name: "Zeta", description: "Last" },
    })
    const created = await service.createDocumentTag({
      connectScope,
      fields: { name: "Alpha", parentId: null },
    })

    expect(created.description).toBeNull()
    const listed = await service.listDocumentTags(connectScope)
    expect(listed.map((tag) => tag.name)).toEqual(["Alpha", "Zeta"])
  })

  it("rejects the reserved public-documents name regardless of case", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }

    await expect(
      service.createDocumentTag({ connectScope, fields: { name: "Public-Documents" } }),
    ).rejects.toBeInstanceOf(BadRequestException)

    const listed = await service.listDocumentTags(connectScope)
    expect(listed).toEqual([])
  })

  it("rejects a child of the public-documents tag", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }
    const publicTag = await service.createPublicDocumentsTag(connectScope)

    await expect(
      service.createDocumentTag({
        connectScope,
        fields: { name: "Child Tag", parentId: publicTag.id },
      }),
    ).rejects.toThrow(`Tag "${PUBLIC_DOCUMENTS_TAG_NAME}" cannot have children.`)
  })

  it("refuses to edit or delete the public-documents tag", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }
    const publicTag = await service.createPublicDocumentsTag(connectScope)

    await expect(
      service.updateDocumentTag({
        connectScope,
        documentTagId: publicTag.id,
        fieldsToUpdate: { name: "Renamed" },
      }),
    ).rejects.toThrow(`Tag "${PUBLIC_DOCUMENTS_TAG_NAME}" cannot be edited.`)

    await expect(
      service.deleteDocumentTag({ connectScope, documentTagId: publicTag.id }),
    ).rejects.toThrow(`Tag "${PUBLIC_DOCUMENTS_TAG_NAME}" cannot be deleted.`)
  })

  it("rejects renaming a tag to the reserved public-documents name", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }
    const created = await service.createDocumentTag({
      connectScope,
      fields: { name: "Draft" },
    })

    await expect(
      service.updateDocumentTag({
        connectScope,
        documentTagId: created.id,
        fieldsToUpdate: { name: "PUBLIC-DOCUMENTS" },
      }),
    ).rejects.toThrow(`Tag name "${PUBLIC_DOCUMENTS_TAG_NAME}" is reserved.`)
  })

  it("updates a tag and hides it from another project", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const other = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }
    const created = await service.createDocumentTag({
      connectScope,
      fields: { name: "Pricing" },
    })

    const updated = await service.updateDocumentTag({
      connectScope,
      documentTagId: created.id,
      fieldsToUpdate: { name: "Support", description: "Help" },
    })
    expect(updated.name).toBe("Support")
    expect(updated.description).toBe("Help")

    const foundElsewhere = await service.findDocumentTagById({
      connectScope: { organizationId: other.organization.id, projectId: other.project.id },
      documentTagId: created.id,
    })
    expect(foundElsewhere).toBeNull()
    await expect(
      service.updateDocumentTag({
        connectScope: { organizationId: other.organization.id, projectId: other.project.id },
        documentTagId: created.id,
        fieldsToUpdate: { name: "Taken" },
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it("adds and removes tags when resolving a change set", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }
    const kept = await service.createDocumentTag({ connectScope, fields: { name: "Kept" } })
    const removed = await service.createDocumentTag({ connectScope, fields: { name: "Removed" } })
    const added = await service.createDocumentTag({ connectScope, fields: { name: "Added" } })

    const nextTags = await service.resolveTagChanges({
      currentTags: [kept, removed],
      tagsToAdd: [added.id],
      tagsToRemove: [removed.id],
    })

    expect(nextTags.map((tag) => tag.id)).toEqual([kept.id, added.id])
  })

  it("deletes a tag and its document and agent links", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }
    const tag = await service.createDocumentTag({ connectScope, fields: { name: "Linked" } })
    const document = await createDocumentForProject({ repositories, organization, project })
    const agent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(agent)
    await setup.dataSource.query(
      "INSERT INTO document_document_tag (document_id, document_tag_id) VALUES ($1, $2)",
      [document.id, tag.id],
    )
    await setup.dataSource.query(
      "INSERT INTO agent_document_tag (agent_id, document_tag_id) VALUES ($1, $2)",
      [agent.id, tag.id],
    )

    await service.deleteDocumentTag({ connectScope, documentTagId: tag.id })

    const documentLinks: { count: string }[] = await setup.dataSource.query(
      "SELECT COUNT(*)::text AS count FROM document_document_tag WHERE document_tag_id = $1",
      [tag.id],
    )
    const agentLinks: { count: string }[] = await setup.dataSource.query(
      "SELECT COUNT(*)::text AS count FROM agent_document_tag WHERE document_tag_id = $1",
      [tag.id],
    )
    expect(documentLinks[0]?.count).toBe("0")
    expect(agentLinks[0]?.count).toBe("0")
    expect(await service.findDocumentTagById({ connectScope, documentTagId: tag.id })).toBeNull()
    expect(
      await repositories.documentRepository.findOne({ where: { id: document.id } }),
    ).not.toBeNull()
    expect(await repositories.agentRepository.findOne({ where: { id: agent.id } })).not.toBeNull()
  })
})
