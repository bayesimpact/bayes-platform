import { describe, expect, it } from "vitest"
import { oauthConsentProjectFactory } from "./oauth-consent.factory"
import {
  availablePermissionsFor,
  buildOAuthDeniedUrl,
  groupConsentProjectsByOrganization,
  parseOAuthAuthorizationRequest,
  permissionsFromScope,
} from "./oauth-consent.utils"

const codeChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

describe("parseOAuthAuthorizationRequest", () => {
  it("reads a complete request and ignores unknown params", () => {
    const search = new URLSearchParams({
      response_type: "code",
      client_id: "client-1",
      redirect_uri: "http://127.0.0.1:8787/callback",
      state: "csrf-state",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      extra: "ignored",
    }).toString()

    expect(parseOAuthAuthorizationRequest(search)).toEqual({
      response_type: "code",
      client_id: "client-1",
      redirect_uri: "http://127.0.0.1:8787/callback",
      state: "csrf-state",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    })
  })

  it("returns null without PKCE", () => {
    const search = "response_type=code&client_id=client-1&redirect_uri=https%3A%2F%2Fexample.com"
    expect(parseOAuthAuthorizationRequest(search)).toBeNull()
  })
})

describe("buildOAuthDeniedUrl", () => {
  it("adds the error and the state", () => {
    expect(buildOAuthDeniedUrl({ redirectUri: "https://example.com/cb?a=1", state: "xyz" })).toBe(
      "https://example.com/cb?a=1&error=access_denied&state=xyz",
    )
  })

  it("works with a private-use scheme and no state", () => {
    expect(buildOAuthDeniedUrl({ redirectUri: "com.example.app:/callback" })).toBe(
      "com.example.app:/callback?error=access_denied",
    )
  })
})

describe("groupConsentProjectsByOrganization", () => {
  it("groups projects under their organization, in list order", () => {
    const firstOrganizationId = "org-acme"
    const support = oauthConsentProjectFactory.build({
      name: "Support",
      organizationId: firstOrganizationId,
      organizationName: "Acme",
    })
    const pricing = oauthConsentProjectFactory.build({
      name: "Pricing",
      organizationId: firstOrganizationId,
      organizationName: "Acme",
    })
    const product = oauthConsentProjectFactory.build({
      name: "Product",
      organizationName: "Globex",
    })

    expect(groupConsentProjectsByOrganization([support, pricing, product])).toEqual([
      {
        organizationId: firstOrganizationId,
        organizationName: "Acme",
        projects: [support, pricing],
      },
      {
        organizationId: product.organizationId,
        organizationName: "Globex",
        projects: [product],
      },
    ])
  })
})

describe("availablePermissionsFor", () => {
  it("unions the permissions of the selected projects only", () => {
    const readOnly = oauthConsentProjectFactory.build({ availablePermissions: ["project.read"] })
    const full = oauthConsentProjectFactory.build({
      availablePermissions: ["project.read", "agent.create"],
    })
    const projects = [readOnly, full]

    expect([...availablePermissionsFor(projects, [readOnly.id])]).toEqual(["project.read"])
    expect(availablePermissionsFor(projects, [readOnly.id, full.id]).has("agent.create")).toBe(true)
    expect(availablePermissionsFor(projects, []).size).toBe(0)
  })
})

describe("permissionsFromScope", () => {
  it("keeps grantable permissions only", () => {
    expect(permissionsFromScope("agent.create unknown project.read")).toEqual([
      "project.read",
      "agent.create",
    ])
    expect(permissionsFromScope(undefined)).toEqual([])
  })
})
