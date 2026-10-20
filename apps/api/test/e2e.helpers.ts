import { randomUUID } from "node:crypto"
import type { AddressInfo } from "node:net"
import { type INestApplication, UnauthorizedException } from "@nestjs/common"
import type { TestingModuleBuilder } from "@nestjs/testing"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { OidcUserInfoService } from "@/domains/auth/oidc-userinfo.service"

/** Email returned by the test OidcUserInfoService mock for a given `sub` (must match seeded user rows). */
export function mockOidcEmailForSub(sub: string): string {
  return `e2e+${sub.replaceAll("|", "-")}@example.com`
}

/**
 * Serves the app on a free port of every interface and returns its loopback URL, for the specs
 * that call it over a real socket. Listening on 127.0.0.1 alone let macOS give the same port to
 * a supertest server of another test worker, which listens on the IPv6 wildcard: that worker's
 * requests to 127.0.0.1 then reached this app and failed with a 404.
 */
export async function listenOnLoopback(app: INestApplication): Promise<string> {
  await app.listen(0)
  const { port } = app.getHttpServer().address() as AddressInfo
  return `http://127.0.0.1:${port}`
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
