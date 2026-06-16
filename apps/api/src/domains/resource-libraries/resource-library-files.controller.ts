import { ResourceLibrariesRoutes } from "@caseai-connect/api-contracts"
import { Controller, Get, Inject, NotFoundException, Param, Res } from "@nestjs/common"
import type { Response } from "express"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ResourceLibrariesService } from "./resource-libraries.service"

/**
 * Public, unauthenticated capability endpoint. The link is keyed by the library + resource UUIDs and
 * only ever signs a storage path that lives under the matching project's own prefix, so it is safe
 * to surface to anonymous / embedded chat users. It 302-redirects to a freshly signed GCS URL.
 */
@Controller()
export class ResourceLibraryFilesController {
  constructor(
    private readonly resourceLibrariesService: ResourceLibrariesService,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
  ) {}

  @Get(ResourceLibrariesRoutes.downloadResourceFile.path)
  async downloadResourceFile(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("resourceLibraryId") resourceLibraryId: string,
    @Param("resourceId") resourceId: string,
    @Res() response: Response,
  ): Promise<void> {
    const resourceLibrary = await this.resourceLibrariesService.findLibraryForDownload({
      organizationId,
      projectId,
      resourceLibraryId,
    })
    if (!resourceLibrary) throw new NotFoundException()

    const resource = (resourceLibrary.resources ?? []).find((item) => item.id === resourceId)
    if (!resource || resource.linkType !== "file" || !resource.file) {
      throw new NotFoundException()
    }

    // Defense in depth: only sign paths that belong to this library's own project prefix.
    const expectedPrefix = `${organizationId}/${projectId}/`
    if (!resource.file.storageRelativePath.startsWith(expectedPrefix)) {
      throw new NotFoundException()
    }

    const signedUrl = await this.fileStorageService.getTemporaryUrl(
      resource.file.storageRelativePath,
    )
    response.redirect(302, signedUrl)
  }
}
