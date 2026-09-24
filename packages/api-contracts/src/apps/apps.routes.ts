import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  AppInstallationSummaryDto,
  AppInstallPageDto,
  AppManifestDto,
  AuthorizeAppInstallRequestDto,
  AuthorizeAppInstallResponseDto,
  CreateAppManifestRequestDto,
  UpdateAppManifestRequestDto,
} from "./apps.dto"

export const AppsRoutes = {
  getAll: defineRoute<ResponseData<AppManifestDto[]>>({
    method: "get",
    path: "backoffice/apps",
  }),
  getOne: defineRoute<ResponseData<AppManifestDto>>({
    method: "get",
    path: "backoffice/apps/:appManifestId",
  }),
  createOne: defineRoute<ResponseData<AppManifestDto>, RequestPayload<CreateAppManifestRequestDto>>(
    {
      method: "post",
      path: "backoffice/apps",
    },
  ),
  updateOne: defineRoute<ResponseData<AppManifestDto>, RequestPayload<UpdateAppManifestRequestDto>>(
    {
      method: "patch",
      path: "backoffice/apps/:appManifestId",
    },
  ),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "backoffice/apps/:appManifestId",
  }),
  getInstall: defineRoute<ResponseData<AppInstallPageDto>>({
    method: "get",
    path: "apps/install/:slug",
  }),
  authorize: defineRoute<
    ResponseData<AuthorizeAppInstallResponseDto>,
    RequestPayload<AuthorizeAppInstallRequestDto>
  >({
    method: "post",
    path: "apps/install/:slug/authorize",
  }),
  revoke: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "post",
    path: "app-installations/:id/revoke",
  }),
  listForProject: defineRoute<ResponseData<AppInstallationSummaryDto[]>>({
    method: "get",
    path: "projects/:projectId/app-installations",
  }),
}
