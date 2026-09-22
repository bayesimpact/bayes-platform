import {
  buildServiceUserAuth0Id,
  buildServiceUserEmail,
  isServiceAuth0Id,
  isServiceUser,
  isServiceUserEmail,
  isUninvitableServiceIdentity,
  SERVICE_USER_AUTH0_ID_PREFIX,
  SERVICE_USER_EMAIL_DOMAIN,
} from "./service-user.helpers"
import { USER_TYPE_HUMAN, USER_TYPE_SERVICE } from "./user.types"

describe("service-user.helpers", () => {
  const installationId = "11111111-1111-4111-8111-111111111111"

  it("builds a synthetic email and auth0 id for an installation", () => {
    expect(buildServiceUserEmail("Helpful-Assistant", installationId)).toBe(
      `helpful-assistant+${installationId}@${SERVICE_USER_EMAIL_DOMAIN}`,
    )
    expect(buildServiceUserAuth0Id(installationId)).toBe(
      `${SERVICE_USER_AUTH0_ID_PREFIX}${installationId}`,
    )
  })

  it("detects service identities", () => {
    expect(isServiceUserEmail(`app+${installationId}@${SERVICE_USER_EMAIL_DOMAIN}`)).toBe(true)
    expect(isServiceUserEmail("person@example.com")).toBe(false)
    expect(isServiceAuth0Id(`service|${installationId}`)).toBe(true)
    expect(isServiceAuth0Id("auth0|human")).toBe(false)
    expect(isServiceUser({ type: USER_TYPE_SERVICE })).toBe(true)
    expect(isServiceUser({ type: USER_TYPE_HUMAN })).toBe(false)
  })

  it("refuses invitations to service emails and service users", () => {
    expect(
      isUninvitableServiceIdentity({
        email: `app+${installationId}@${SERVICE_USER_EMAIL_DOMAIN}`,
      }),
    ).toBe(true)
    expect(
      isUninvitableServiceIdentity({
        email: "person@example.com",
        user: { type: USER_TYPE_SERVICE },
      }),
    ).toBe(true)
    expect(
      isUninvitableServiceIdentity({
        email: "person@example.com",
        user: { type: USER_TYPE_HUMAN },
      }),
    ).toBe(false)
  })
})
