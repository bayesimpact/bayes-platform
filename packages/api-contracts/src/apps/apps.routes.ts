import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  AppInstallationSummaryDto,
  AppManifestDto,
  AppOAuthClientDto,
  AppOAuthClientSecretDto,
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
  /** The OAuth client of the app (ADR 0029), null before its first secret. */
  getOAuthClient: defineRoute<ResponseData<AppOAuthClientDto>>({
    method: "get",
    path: "backoffice/apps/:appManifestId/oauth-client",
  }),
  /** Creates the client or replaces its secret. The secret is returned this once. */
  createOAuthClientSecret: defineRoute<ResponseData<AppOAuthClientSecretDto>>({
    method: "post",
    path: "backoffice/apps/:appManifestId/oauth-client/secret",
  }),
}

/** The apps installed on a project, as its owners and admins see them in the studio. */
export const ProjectAppInstallationsRoutes = {
  getAll: defineRoute<ResponseData<AppInstallationSummaryDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/app-installations",
  }),
  revokeOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/app-installations/:appInstallationId/revoke",
  }),
}
