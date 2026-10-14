import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { OAuthGrant, OAuthGrantClient, OAuthGrantProject } from "./oauth-grants.models"

class OAuthGrantClientFactory extends Factory<OAuthGrantClient> {}

export const oauthGrantClientFactory = OAuthGrantClientFactory.define(({ params }) => ({
  clientId: params.clientId ?? "https://app.example.com/oauth/client.json",
  name: params.name === undefined ? "Helpful Assistant" : params.name,
  verified: params.verified ?? true,
}))

class OAuthGrantProjectFactory extends Factory<OAuthGrantProject> {}

export const oauthGrantProjectFactory = OAuthGrantProjectFactory.define(({ params, sequence }) => ({
  id: params.id ?? faker.string.uuid(),
  name: params.name ?? `Project ${sequence}`,
}))

class OAuthGrantFactory extends Factory<OAuthGrant> {}

export const oauthGrantFactory = OAuthGrantFactory.define(({ params }) => ({
  id: params.id ?? faker.string.uuid(),
  client: oauthGrantClientFactory.build(params.client),
  projects: params.projects ?? oauthGrantProjectFactory.buildList(1),
  permissions: params.permissions ?? ["project.read"],
  createdAt: params.createdAt ?? faker.date.recent({ days: 60 }).getTime(),
  lastUsedAt:
    params.lastUsedAt === undefined ? faker.date.recent({ days: 3 }).getTime() : params.lastUsedAt,
}))
