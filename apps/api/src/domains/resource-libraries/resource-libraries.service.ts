import { randomUUID } from "node:crypto"
import type {
  CreateResourceDto,
  ResourceDto,
  UpdateResourceDto,
} from "@caseai-connect/api-contracts"
import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { ResourceLibrary } from "./resource-library.entity"

@Injectable()
export class ResourceLibrariesService {
  constructor(
    @InjectRepository(ResourceLibrary)
    private readonly resourceLibraryRepository: Repository<ResourceLibrary>,
  ) {
    this.resourceLibraryConnectRepository = new ConnectRepository(
      resourceLibraryRepository,
      "resource-libraries",
    )
  }

  private readonly resourceLibraryConnectRepository: ConnectRepository<ResourceLibrary>

  async createResourceLibrary({
    connectScope,
    fields,
  }: {
    connectScope: RequiredConnectScope
    fields: { title: string }
  }): Promise<ResourceLibrary> {
    return await this.resourceLibraryConnectRepository.createAndSave(connectScope, {
      title: fields.title,
      resources: [],
    })
  }

  async listResourceLibraries(connectScope: RequiredConnectScope): Promise<ResourceLibrary[]> {
    return (await this.resourceLibraryConnectRepository.getMany(connectScope))?.sort((a, b) =>
      a.title.localeCompare(b.title),
    )
  }

  async findResourceLibraryById({
    connectScope,
    resourceLibraryId,
  }: {
    connectScope: RequiredConnectScope
    resourceLibraryId: string
  }): Promise<ResourceLibrary | null> {
    return this.resourceLibraryConnectRepository.getOneById(connectScope, resourceLibraryId)
  }

  async findResourceLibrariesByIds({
    connectScope,
    ids,
  }: {
    connectScope: RequiredConnectScope
    ids: string[]
  }): Promise<ResourceLibrary[]> {
    if (ids.length === 0) return []
    return this.resourceLibraryRepository.findBy({
      id: In(ids),
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
    })
  }

  async updateResourceLibrary({
    connectScope,
    resourceLibraryId,
    fieldsToUpdate,
  }: {
    connectScope: RequiredConnectScope
    resourceLibraryId: string
    fieldsToUpdate: { title: string }
  }): Promise<ResourceLibrary> {
    const resourceLibrary = await this.getResourceLibraryOrThrow(connectScope, resourceLibraryId)

    Object.assign(resourceLibrary, fieldsToUpdate)

    return await this.resourceLibraryConnectRepository.saveOne(resourceLibrary)
  }

  async addResource({
    connectScope,
    resourceLibraryId,
    fields,
  }: {
    connectScope: RequiredConnectScope
    resourceLibraryId: string
    fields: CreateResourceDto
  }): Promise<ResourceLibrary> {
    const resourceLibrary = await this.getResourceLibraryOrThrow(connectScope, resourceLibraryId)

    const resource: ResourceDto = { ...fields, id: randomUUID() }
    resourceLibrary.resources = [...resourceLibrary.resources, resource]

    return await this.resourceLibraryConnectRepository.saveOne(resourceLibrary)
  }

  async updateResource({
    connectScope,
    resourceLibraryId,
    resourceId,
    fields,
  }: {
    connectScope: RequiredConnectScope
    resourceLibraryId: string
    resourceId: string
    fields: UpdateResourceDto
  }): Promise<ResourceLibrary> {
    const resourceLibrary = await this.getResourceLibraryOrThrow(connectScope, resourceLibraryId)

    if (!resourceLibrary.resources.some((resource) => resource.id === resourceId)) {
      throw new NotFoundException(`Resource with id ${resourceId} not found`)
    }

    resourceLibrary.resources = resourceLibrary.resources.map((resource) =>
      resource.id === resourceId ? { ...fields, id: resourceId } : resource,
    )

    return await this.resourceLibraryConnectRepository.saveOne(resourceLibrary)
  }

  async deleteResource({
    connectScope,
    resourceLibraryId,
    resourceId,
  }: {
    connectScope: RequiredConnectScope
    resourceLibraryId: string
    resourceId: string
  }): Promise<ResourceLibrary> {
    const resourceLibrary = await this.getResourceLibraryOrThrow(connectScope, resourceLibraryId)

    if (!resourceLibrary.resources.some((resource) => resource.id === resourceId)) {
      throw new NotFoundException(`Resource with id ${resourceId} not found`)
    }

    resourceLibrary.resources = resourceLibrary.resources.filter(
      (resource) => resource.id !== resourceId,
    )

    return await this.resourceLibraryConnectRepository.saveOne(resourceLibrary)
  }

  private async getResourceLibraryOrThrow(
    connectScope: RequiredConnectScope,
    resourceLibraryId: string,
  ): Promise<ResourceLibrary> {
    const resourceLibrary = await this.resourceLibraryConnectRepository.getOneById(
      connectScope,
      resourceLibraryId,
    )

    if (!resourceLibrary) {
      throw new NotFoundException(`ResourceLibrary with id ${resourceLibraryId} not found`)
    }

    return resourceLibrary
  }

  async deleteResourceLibrary({
    connectScope,
    resourceLibraryId,
  }: {
    connectScope: RequiredConnectScope
    resourceLibraryId: string
  }): Promise<void> {
    const resourceLibrary = await this.resourceLibraryConnectRepository.getOneById(
      connectScope,
      resourceLibraryId,
    )

    if (!resourceLibrary) {
      throw new NotFoundException(`ResourceLibrary with id ${resourceLibraryId} not found`)
    }

    // Manually delete join-table rows before deleting the library to avoid foreign key errors.
    await this.resourceLibraryRepository.manager.query(
      "DELETE FROM agent_resource_library WHERE resource_library_id = $1",
      [resourceLibrary.id],
    )

    await this.resourceLibraryConnectRepository.deleteOneById({
      connectScope,
      id: resourceLibrary.id,
    })
  }

  /**
   * Loads a library for the public, unauthenticated download endpoint, scoped explicitly by the
   * organization and project ids from the request path (there is no auth-derived connect scope).
   */
  async findLibraryForDownload({
    organizationId,
    projectId,
    resourceLibraryId,
  }: {
    organizationId: string
    projectId: string
    resourceLibraryId: string
  }): Promise<ResourceLibrary | null> {
    return this.resourceLibraryRepository.findOne({
      where: { id: resourceLibraryId, organizationId, projectId },
    })
  }
}
