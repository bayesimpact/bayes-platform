import { Injectable, NotFoundException } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ResourceLibrariesService } from "@/domains/resource-libraries/resource-libraries.service"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type { EndpointRequestWithResourceLibrary } from "../request.interface"
import { getRequiredConnectScope } from "../request-context.helpers"

@Injectable()
export class ResourceLibraryContextResolver implements ContextResolver {
  readonly resource = "resourceLibrary" as const

  constructor(private readonly resourceLibrariesService: ResourceLibrariesService) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithParams = request as ResolvableRequest & {
      params: { resourceLibraryId?: string }
    }
    const resourceLibraryId = requestWithParams.params?.resourceLibraryId

    if (!resourceLibraryId || resourceLibraryId === ":resourceLibraryId") {
      throw new NotFoundException()
    }

    const requestWithResourceLibrary = request as EndpointRequestWithResourceLibrary
    const resourceLibrary =
      (await this.resourceLibrariesService.findResourceLibraryById({
        connectScope: getRequiredConnectScope(requestWithResourceLibrary),
        resourceLibraryId,
      })) ?? undefined
    if (!resourceLibrary) throw new NotFoundException()

    requestWithResourceLibrary.resourceLibrary = resourceLibrary
  }
}
