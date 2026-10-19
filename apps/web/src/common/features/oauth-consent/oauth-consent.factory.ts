import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type {
  OAuthAuthorizationRequest,
  OAuthConsentClient,
  OAuthConsentPage,
  OAuthConsentProject,
} from "./oauth-consent.models"

class OAuthConsentProjectFactory extends Factory<OAuthConsentProject> {}

export const oauthConsentProjectFactory = OAuthConsentProjectFactory.define(
  ({ params, sequence }) => ({
    id: params.id ?? faker.string.uuid(),
    name: params.name ?? `Project ${sequence}`,
    organizationId: params.organizationId ?? faker.string.uuid(),
    organizationName: params.organizationName ?? "Acme",
    availablePermissions: params.availablePermissions ?? ["project.read", "agent.create"],
  }),
)

class OAuthConsentClientFactory extends Factory<OAuthConsentClient> {}

export const oauthConsentClientFactory = OAuthConsentClientFactory.define(({ params }) => ({
  clientId: params.clientId ?? faker.string.uuid(),
  kind: params.kind ?? "mcp",
  name: params.name === undefined ? "Helpful Assistant" : params.name,
  redirectHost: params.redirectHost ?? "app.example.com",
  verified: params.verified ?? true,
  description: params.description === undefined ? null : params.description,
  logoUrl: params.logoUrl === undefined ? null : params.logoUrl,
}))

class OAuthConsentPageFactory extends Factory<OAuthConsentPage> {}

export const oauthConsentPageFactory = OAuthConsentPageFactory.define(({ params }) => ({
  client: oauthConsentClientFactory.build(params.client),
  projects: params.projects ?? oauthConsentProjectFactory.buildList(2),
  grantablePermissions: params.grantablePermissions ?? ["project.read", "agent.create"],
}))

class OAuthAuthorizationRequestFactory extends Factory<OAuthAuthorizationRequest> {}

export const oauthAuthorizationRequestFactory = OAuthAuthorizationRequestFactory.define(
  ({ params }) => ({
    response_type: "code" as const,
    client_id: params.client_id ?? faker.string.uuid(),
    redirect_uri: params.redirect_uri ?? "https://app.example.com/oauth/callback",
    state: params.state ?? "csrf-state",
    code_challenge: params.code_challenge ?? "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    code_challenge_method: "S256" as const,
    scope: params.scope ?? "project.read agent.create",
    resource: params.resource,
  }),
)
