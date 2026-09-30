import {
  buildServiceUserAuthSubject,
  buildServiceUserEmail,
  isServiceAuthSubject,
  isServiceIdentity,
  isServiceUser,
  isServiceUserEmail,
  SERVICE_USER_AUTH_SUBJECT_PREFIX,
  SERVICE_USER_EMAIL_DOMAIN,
} from "./service-user.helpers"
import { USER_TYPE_HUMAN, USER_TYPE_SERVICE } from "./user.types"

describe("service-user.helpers", () => {
  const installationId = "11111111-1111-4111-8111-111111111111"

  it("builds a synthetic email and subject for an installation", () => {
    expect(buildServiceUserEmail("Helpful-Assistant", installationId)).toBe(
      `helpful-assistant+${installationId}@${SERVICE_USER_EMAIL_DOMAIN}`,
    )
    expect(buildServiceUserAuthSubject(installationId)).toBe(
      `${SERVICE_USER_AUTH_SUBJECT_PREFIX}${installationId}`,
    )
  })

  it("detects service identities", () => {
    expect(isServiceUserEmail(`app+${installationId}@${SERVICE_USER_EMAIL_DOMAIN}`)).toBe(true)
    expect(isServiceUserEmail("person@example.com")).toBe(false)
    expect(isServiceAuthSubject(`service|${installationId}`)).toBe(true)
    expect(isServiceAuthSubject("oidc|human")).toBe(false)
    expect(isServiceUser({ type: USER_TYPE_SERVICE })).toBe(true)
    expect(isServiceUser({ type: USER_TYPE_HUMAN })).toBe(false)
  })

  it("recognizes service emails and service users", () => {
    expect(
      isServiceIdentity({
        email: `app+${installationId}@${SERVICE_USER_EMAIL_DOMAIN}`,
      }),
    ).toBe(true)
    expect(
      isServiceIdentity({
        email: "person@example.com",
        user: { type: USER_TYPE_SERVICE },
      }),
    ).toBe(true)
    expect(
      isServiceIdentity({
        email: "person@example.com",
        user: { type: USER_TYPE_HUMAN },
      }),
    ).toBe(false)
  })
})
