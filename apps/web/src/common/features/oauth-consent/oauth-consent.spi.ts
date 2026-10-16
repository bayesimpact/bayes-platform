import type {
  ApproveOAuthConsentInput,
  ApproveOAuthConsentResult,
  OAuthAuthorizationRequest,
  OAuthConsentPage,
} from "./oauth-consent.models"

export interface IOAuthConsentSpi {
  getConsentPage: (request: OAuthAuthorizationRequest) => Promise<OAuthConsentPage>
  approve: (input: ApproveOAuthConsentInput) => Promise<ApproveOAuthConsentResult>
}
