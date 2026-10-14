import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  OAuthClientRegistrationResponseDto,
  OAuthConsentDto,
  OAuthConsentPageDto,
  OAuthConsentResponseDto,
  OAuthGrantDto,
  OAuthTokenResponseDto,
} from "./oauth.dto"

export const OAuthRoutes = {
  // RFC 7591, RFC 6749 and RFC 7009 bodies: unwrapped snake_case, not { data }.
  register: defineRoute<OAuthClientRegistrationResponseDto>({
    method: "post",
    path: "oauth/register",
  }),
  createToken: defineRoute<OAuthTokenResponseDto>({
    method: "post",
    path: "oauth/token",
  }),
  revokeToken: defineRoute<Record<string, never>>({
    method: "post",
    path: "oauth/revoke",
  }),
  /** Consent page of the web app: checks the request and lists what can be granted. */
  getConsent: defineRoute<ResponseData<OAuthConsentPageDto>>({
    method: "get",
    path: "oauth/consent",
  }),
  approveConsent: defineRoute<
    ResponseData<OAuthConsentResponseDto>,
    RequestPayload<OAuthConsentDto>
  >({
    method: "post",
    path: "oauth/consent",
  }),
  getAllGrants: defineRoute<ResponseData<OAuthGrantDto[]>>({
    method: "get",
    path: "oauth/grants",
  }),
  deleteOneGrant: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "oauth/grants/:grantId",
  }),
}
