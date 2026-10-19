import type { ResponseData } from "../generic"
import { defineRoute } from "../helpers"
import type { AppMeResponseDto } from "./apps.dto"

/**
 * The apps API. An app calls it with an access token of the authorization
 * server (ADR 0029), whose audience is `<API>/api/apps/v1`.
 */
export const AppsV1Routes = {
  getMe: defineRoute<ResponseData<AppMeResponseDto>>({
    method: "get",
    path: "apps/v1/me",
  }),
}
