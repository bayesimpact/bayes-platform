import type { ResponseData } from "../generic"
import { defineRoute } from "../helpers"
import type {
  AppAccessTokenResponseDto,
  AppMeResponseDto,
  ExchangeAppInstallCodeResponseDto,
} from "./apps.dto"

export const AppsV1Routes = {
  // RFC 6749 token response: unwrapped snake_case, not { data }.
  createToken: defineRoute<AppAccessTokenResponseDto>({
    method: "post",
    path: "apps/v1/token",
  }),
  /** One-time install code → client credentials. Unauthenticated; unwrapped body. */
  exchangeInstallCode: defineRoute<ExchangeAppInstallCodeResponseDto>({
    method: "post",
    path: "apps/v1/install/exchange",
  }),
  getMe: defineRoute<ResponseData<AppMeResponseDto>>({
    method: "get",
    path: "apps/v1/me",
  }),
}
