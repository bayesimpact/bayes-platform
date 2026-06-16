import {
  createResourceLibrarySchema,
  createResourceSchema,
  documentUploadAllowedMimeTypePattern,
  isAllowedMimeType,
  ResourceLibrariesRoutes,
  type ResourceLibraryDto,
  updateResourceLibrarySchema,
  updateResourceSchema,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Req,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express/multer"
import type {
  EndpointRequestWithProject,
  EndpointRequestWithResourceLibrary,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import type { MulterFile } from "@/common/types"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import { UserGuard } from "@/domains/users/user.guard"
import {
  extractResourceFileExtension,
  normalizeResourceFileName,
} from "./resource-libraries.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ResourceLibrariesService } from "./resource-libraries.service"
import type { ResourceLibrary } from "./resource-library.entity"
import { ResourceLibraryGuard } from "./resource-library.guard"

const MEGABYTE = 1024 * 1024
const MAX_RESOURCE_FILE_SIZE = 25 * MEGABYTE

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, ResourceLibraryGuard)
@RequireContext("organization", "project")
@Controller()
export class ResourceLibrariesController {
  constructor(
    private readonly resourceLibrariesService: ResourceLibrariesService,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
  ) {}

  @Post(ResourceLibrariesRoutes.createOne.path)
  @CheckPolicy((policy) => policy.canCreate())
  @TrackActivity({ action: "resourceLibrary.create" })
  @UsePipes(new ZodValidationPipe(createResourceLibrarySchema))
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @Body() { payload }: typeof ResourceLibrariesRoutes.createOne.request,
  ): Promise<typeof ResourceLibrariesRoutes.createOne.response> {
    const resourceLibrary = await this.resourceLibrariesService.createResourceLibrary({
      connectScope: getRequiredConnectScope(request),
      fields: { title: payload.title },
    })

    return { data: toResourceLibraryDto(resourceLibrary) }
  }

  @Get(ResourceLibrariesRoutes.getAll.path)
  @CheckPolicy((policy) => policy.canList())
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof ResourceLibrariesRoutes.getAll.response> {
    const resourceLibraries = await this.resourceLibrariesService.listResourceLibraries(
      getRequiredConnectScope(request),
    )
    return { data: resourceLibraries.map(toResourceLibraryDto) }
  }

  @Patch(ResourceLibrariesRoutes.updateOne.path)
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("resourceLibrary")
  @TrackActivity({ action: "resourceLibrary.update", entityFrom: "resourceLibrary" })
  @UsePipes(new ZodValidationPipe(updateResourceLibrarySchema))
  async updateOne(
    @Req() request: EndpointRequestWithResourceLibrary,
    @Body() { payload }: typeof ResourceLibrariesRoutes.updateOne.request,
  ): Promise<typeof ResourceLibrariesRoutes.updateOne.response> {
    await this.resourceLibrariesService.updateResourceLibrary({
      connectScope: getRequiredConnectScope(request),
      resourceLibraryId: request.resourceLibrary.id,
      fieldsToUpdate: { title: payload.title },
    })
    return { data: { success: true } }
  }

  @Post(ResourceLibrariesRoutes.addResource.path)
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("resourceLibrary")
  @TrackActivity({ action: "resourceLibrary.addResource", entityFrom: "resourceLibrary" })
  @UsePipes(new ZodValidationPipe(createResourceSchema))
  async addResource(
    @Req() request: EndpointRequestWithResourceLibrary,
    @Body() { payload }: typeof ResourceLibrariesRoutes.addResource.request,
  ): Promise<typeof ResourceLibrariesRoutes.addResource.response> {
    const resourceLibrary = await this.resourceLibrariesService.addResource({
      connectScope: getRequiredConnectScope(request),
      resourceLibraryId: request.resourceLibrary.id,
      fields: payload,
    })
    return { data: toResourceLibraryDto(resourceLibrary) }
  }

  @Patch(ResourceLibrariesRoutes.updateResource.path)
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("resourceLibrary")
  @TrackActivity({ action: "resourceLibrary.updateResource", entityFrom: "resourceLibrary" })
  async updateResource(
    @Req() request: EndpointRequestWithResourceLibrary,
    @Param("resourceId") resourceId: string,
    // The pipe is bound to the body (not the whole method) so it does not also run on `resourceId`.
    @Body(new ZodValidationPipe(updateResourceSchema))
    { payload }: typeof ResourceLibrariesRoutes.updateResource.request,
  ): Promise<typeof ResourceLibrariesRoutes.updateResource.response> {
    const resourceLibrary = await this.resourceLibrariesService.updateResource({
      connectScope: getRequiredConnectScope(request),
      resourceLibraryId: request.resourceLibrary.id,
      resourceId,
      fields: payload,
    })
    return { data: toResourceLibraryDto(resourceLibrary) }
  }

  @Delete(ResourceLibrariesRoutes.deleteResource.path)
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("resourceLibrary")
  @TrackActivity({ action: "resourceLibrary.deleteResource", entityFrom: "resourceLibrary" })
  async deleteResource(
    @Req() request: EndpointRequestWithResourceLibrary,
    @Param("resourceId") resourceId: string,
  ): Promise<typeof ResourceLibrariesRoutes.deleteResource.response> {
    await this.resourceLibrariesService.deleteResource({
      connectScope: getRequiredConnectScope(request),
      resourceLibraryId: request.resourceLibrary.id,
      resourceId,
    })
    return { data: { success: true } }
  }

  @Delete(ResourceLibrariesRoutes.deleteOne.path)
  @CheckPolicy((policy) => policy.canDelete())
  @AddContext("resourceLibrary")
  @TrackActivity({ action: "resourceLibrary.delete", entityFrom: "resourceLibrary" })
  async deleteOne(
    @Req() request: EndpointRequestWithResourceLibrary,
  ): Promise<typeof ResourceLibrariesRoutes.deleteOne.response> {
    await this.resourceLibrariesService.deleteResourceLibrary({
      connectScope: getRequiredConnectScope(request),
      resourceLibraryId: request.resourceLibrary.id,
    })
    return { data: { success: true } }
  }

  @Post(ResourceLibrariesRoutes.uploadResourceFile.path)
  @CheckPolicy((policy) => policy.canCreate())
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor("file"))
  async uploadResourceFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_RESOURCE_FILE_SIZE }),
          new FileTypeValidator({
            fileType: documentUploadAllowedMimeTypePattern,
            skipMagicNumbersValidation: true,
          }),
        ],
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    )
    file: MulterFile,
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof ResourceLibrariesRoutes.uploadResourceFile.response> {
    if (!file?.mimetype) {
      throw new UnprocessableEntityException("File MIME type is required.")
    }
    if (!isAllowedMimeType(file.mimetype)) {
      throw new UnprocessableEntityException(`Invalid file type: ${file.mimetype}.`)
    }

    const fileName = normalizeResourceFileName(file.originalname)
    const extension = extractResourceFileExtension(fileName)
    const connectScope = getRequiredConnectScope(request)
    const fileInfo = await this.fileStorageService.save({ file, connectScope, extension })

    return {
      data: {
        storageRelativePath: fileInfo.storageRelativePath,
        fileName,
        mimeType: file.mimetype,
      },
    }
  }
}

export function toResourceLibraryDto(entity: ResourceLibrary): ResourceLibraryDto {
  return {
    id: entity.id,
    title: entity.title,
    resources: entity.resources ?? [],
    organizationId: entity.organizationId,
    projectId: entity.projectId,
    createdAt: entity.createdAt.getTime(),
    updatedAt: entity.updatedAt.getTime(),
  }
}
