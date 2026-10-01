import { randomUUID } from "node:crypto"
import { UnauthorizedException } from "@nestjs/common"
import type { TestingModuleBuilder } from "@nestjs/testing"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { OidcUserInfoService } from "@/domains/auth/oidc-userinfo.service"

/** Email returned by the test OidcUserInfoService mock for a given `sub` (must match seeded user rows). */
export function mockOidcEmailForSub(sub: string): string {
  return `e2e+${sub.replaceAll("|", "-")}@example.com`
}

/** Distinct OIDC `sub` for "wrong user" e2e cases (avoids duplicate rows under parallel workers). */
export function mockForeignAuthSubject(): string {
  return `oidc|foreign-${randomUUID()}`
}

function createOidcUserInfoServiceMock(buildAuthSubject: () => string) {
  return {
    getUserInfo: jest.fn().mockImplementation(() => {
      const sub = buildAuthSubject()
      return Promise.resolve({
        sub,
        email: mockOidcEmailForSub(sub),
        email_verified: true,
        name: "Test User",
        picture: "http://picture.url",
      })
    }),
  }
}

export const setupUserGuardForTesting = (
  moduleBuilder: TestingModuleBuilder,
  buildAuthSubject: () => string,
): TestingModuleBuilder => {
  const oidcUserInfoServiceMock = createOidcUserInfoServiceMock(buildAuthSubject)
  return moduleBuilder
    .overrideGuard(JwtAuthGuard)
    .useValue({
      // biome-ignore lint/suspicious/noExplicitAny: for test only
      canActivate: (context: any) => {
        const request = context.switchToHttp().getRequest()
        const accessToken = request.headers?.authorization?.replace(/^Bearer /i, "")
        if (!accessToken) {
          throw new UnauthorizedException(AUTH_ERRORS.NO_ACCESS_TOKEN)
        }
        request.user = { sub: buildAuthSubject() }
        return true
      },
    })
    .overrideProvider(OidcUserInfoService)
    .useValue(oidcUserInfoServiceMock)
}
