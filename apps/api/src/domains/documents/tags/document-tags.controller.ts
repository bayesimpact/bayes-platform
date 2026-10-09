import { type DocumentTagDto, DocumentTagsRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, Delete, Get, Patch, Post, Req, UseGuards } from "@nestjs/common"
import type {
  EndpointRequestWithDocumentTag,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  DOCUMENT_TAG_CREATE_PERMISSION,
  DOCUMENT_TAG_DELETE_PERMISSION,
  DOCUMENT_TAG_READ_PERMISSION,
  DOCUMENT_TAG_UPDATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import type { DocumentTag } from "./document-tag.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentTagsService } from "./document-tags.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project")
@Controller()
export class DocumentTagsController {
  constructor(private readonly documentTagsService: DocumentTagsService) {}

  @Post(DocumentTagsRoutes.createOne.path)
  @CheckPermission(DOCUMENT_TAG_CREATE_PERMISSION, "project")
  @TrackActivity({ action: "documentTag.create" })
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @Body() { payload }: typeof DocumentTagsRoutes.createOne.request,
  ): Promise<typeof DocumentTagsRoutes.createOne.response> {
    const documentTag = await this.documentTagsService.createDocumentTag({
      connectScope: getRequiredConnectScope(request),
      fields: payload,
    })

    return {
      // No need to calculate childrenIds for a newly created tag, as it won't have any children yet
      data: toDocumentTagDto([])(documentTag),
    }
  }

  @Get(DocumentTagsRoutes.getAll.path)
  @CheckPermission(DOCUMENT_TAG_READ_PERMISSION, "project")
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof DocumentTagsRoutes.getAll.response> {
    const documentTags = await this.documentTagsService.listDocumentTags(
      getRequiredConnectScope(request),
    )
    return {
      data: documentTags.map(toDocumentTagDto(documentTags)),
    }
  }

  @Patch(DocumentTagsRoutes.updateOne.path)
  @CheckPermission(DOCUMENT_TAG_UPDATE_PERMISSION, "project")
  @AddContext("documentTag")
  @TrackActivity({ action: "documentTag.update", entityFrom: "documentTag" })
  async updateOne(
    @Req() request: EndpointRequestWithDocumentTag,
    @Body() { payload }: typeof DocumentTagsRoutes.updateOne.request,
  ): Promise<typeof DocumentTagsRoutes.updateOne.response> {
    await this.documentTagsService.updateDocumentTag({
      connectScope: getRequiredConnectScope(request),
      documentTagId: request.documentTag.id,
      fieldsToUpdate: {
        name: payload.name,
        description: payload.description ?? null,
        parentId: payload.parentId ?? null,
      },
    })
    return { data: { success: true } }
  }

  @Delete(DocumentTagsRoutes.deleteOne.path)
  @CheckPermission(DOCUMENT_TAG_DELETE_PERMISSION, "project")
  @AddContext("documentTag")
  @TrackActivity({ action: "documentTag.delete", entityFrom: "documentTag" })
  async deleteOne(
    @Req() request: EndpointRequestWithDocumentTag,
  ): Promise<typeof DocumentTagsRoutes.deleteOne.response> {
    await this.documentTagsService.deleteDocumentTag({
      connectScope: getRequiredConnectScope(request),
      documentTagId: request.documentTag.id,
    })

    return { data: { success: true } }
  }
}

export function toDocumentTagDto(entities: DocumentTag[]) {
  return (entity: DocumentTag): DocumentTagDto => ({
    createdAt: entity.createdAt.getTime(),
    description: entity.description ?? undefined,
    id: entity.id,
    name: entity.name,
    organizationId: entity.organizationId,
    parentId: entity.parentId ?? undefined,
    projectId: entity.projectId,
    updatedAt: entity.updatedAt.getTime(),
    childrenIds: getChildrenIds(entities, entity.id),
  })
}

// Filter the list of all tags to find those whose parentId matches the current tag's id, and map them to their ids
function getChildrenIds(documentTags: DocumentTag[], parentId: string): string[] {
  const children = documentTags.filter((tag) => tag.parentId === parentId)
  const childrenIds = children.map((child) => child.id)

  // Recursively get the ids of the children's children
  for (const child of children) {
    childrenIds.push(...getChildrenIds(documentTags, child.id))
  }

  return childrenIds
}
