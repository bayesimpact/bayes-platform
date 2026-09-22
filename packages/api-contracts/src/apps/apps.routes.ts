import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  AppManifestDto,
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
}
