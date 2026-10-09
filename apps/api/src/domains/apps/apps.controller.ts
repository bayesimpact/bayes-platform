import {
  type AppManifestDto,
  AppsRoutes,
  createAppManifestSchema,
  updateAppManifestSchema,
} from "@caseai-connect/api-contracts"
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { attachTrackedActivity } from "@/domains/activities/attach-tracked-activity"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { BACKOFFICE_APP_MANAGE_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import type { AppManifestRecord } from "./app-manifest.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppsService } from "./apps.service"

@UseGuards(JwtAuthGuard, UserGuard, CheckPermissionGuard)
@Controller()
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  @CheckPermission(BACKOFFICE_APP_MANAGE_PERMISSION)
  @Get(AppsRoutes.getAll.path)
  async getAll(): Promise<typeof AppsRoutes.getAll.response> {
    const manifests = await this.appsService.listAppManifests()
    return { data: manifests.map(toAppManifestDto) }
  }

  @CheckPermission(BACKOFFICE_APP_MANAGE_PERMISSION)
  @Get(AppsRoutes.getOne.path)
  async getOne(
    @Param("appManifestId") appManifestId: string,
  ): Promise<typeof AppsRoutes.getOne.response> {
    const manifest = await this.appsService.getAppManifest(appManifestId)
    return { data: toAppManifestDto(manifest) }
  }

  @CheckPermission(BACKOFFICE_APP_MANAGE_PERMISSION)
  @Post(AppsRoutes.createOne.path)
  @TrackActivity({ action: "appManifest.create" })
  async createOne(
    @Body(new ZodValidationPipe(createAppManifestSchema)) body: typeof AppsRoutes.createOne.request,
  ): Promise<typeof AppsRoutes.createOne.response> {
    const manifest = await this.appsService.createAppManifest({
      name: body.payload.name,
      slug: body.payload.slug,
      description: body.payload.description ?? null,
      logoUrl: body.payload.logoUrl ?? null,
      grantablePermissions: body.payload.grantablePermissions,
      allowedRedirectUris: body.payload.allowedRedirectUris ?? [],
    })
    return { data: toAppManifestDto(manifest) }
  }

  @CheckPermission(BACKOFFICE_APP_MANAGE_PERMISSION)
  @Patch(AppsRoutes.updateOne.path)
  @TrackActivity({ action: "appManifest.update", entityFrom: "appManifest" })
  async updateOne(
    @Req() request: EndpointRequest,
    @Param("appManifestId") appManifestId: string,
    @Body(new ZodValidationPipe(updateAppManifestSchema)) body: typeof AppsRoutes.updateOne.request,
  ): Promise<typeof AppsRoutes.updateOne.response> {
    const manifest = await this.appsService.updateAppManifest(appManifestId, body.payload)
    attachTrackedActivity(request, { entityFrom: "appManifest", entityId: manifest.id })
    return { data: toAppManifestDto(manifest) }
  }

  @CheckPermission(BACKOFFICE_APP_MANAGE_PERMISSION)
  @Delete(AppsRoutes.deleteOne.path)
  @TrackActivity({ action: "appManifest.delete", entityFrom: "appManifest" })
  async deleteOne(
    @Req() request: EndpointRequest,
    @Param("appManifestId") appManifestId: string,
  ): Promise<typeof AppsRoutes.deleteOne.response> {
    await this.appsService.deleteAppManifest(appManifestId)
    attachTrackedActivity(request, { entityFrom: "appManifest", entityId: appManifestId })
    return { data: { success: true } }
  }
}

function toAppManifestDto(manifest: AppManifestRecord): AppManifestDto {
  return {
    id: manifest.id,
    name: manifest.name,
    slug: manifest.slug,
    description: manifest.description,
    logoUrl: manifest.logoUrl,
    grantablePermissions: manifest.grantablePermissions as AppManifestDto["grantablePermissions"],
    allowedRedirectUris: manifest.allowedRedirectUris,
    createdAt: manifest.createdAt.getTime(),
  }
}
