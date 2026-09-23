import type { ResponseData } from "../generic"
import { defineRoute } from "../helpers"
import type {
  AppAccessTokenResponseDto,
  AppMeResponseDto,
  CreateAppDocumentResponseDto,
} from "./apps.dto"

export const AppsV1Routes = {
  // RFC 6749 token response: unwrapped snake_case, not { data }.
  createToken: defineRoute<AppAccessTokenResponseDto>({
    method: "post",
    path: "apps/v1/token",
  }),
  getMe: defineRoute<ResponseData<AppMeResponseDto>>({
    method: "get",
    path: "apps/v1/me",
  }),
  createDocument: defineRoute<ResponseData<CreateAppDocumentResponseDto>>({
    method: "post",
    path: "apps/v1/projects/:projectId/documents",
  }),
}
