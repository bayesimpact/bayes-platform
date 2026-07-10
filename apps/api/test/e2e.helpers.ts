import { randomUUID } from "node:crypto"
import { UnauthorizedException } from "@nestjs/common"
import type { TestingModuleBuilder } from "@nestjs/testing"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { Auth0UserInfoService } from "@/domains/auth/auth0-userinfo.service"
import { INVITATION_SENDER } from "@/domains/auth/invitation-sender.interface"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"

/** Email returned by the test Auth0UserInfo mock for a given `sub` (must match seeded invite / user rows). */
export function mockAuth0EmailForSub(sub: string): string {
  return `e2e+${sub.replaceAll("|", "-")}@example.com`
}

/** Distinct Auth0 `sub` for "wrong user" e2e cases (avoids duplicate rows under parallel workers). */
export function mockForeignAuth0Id(): string {
  return `auth0|foreign-${randomUUID()}`
}

function createAuth0UserInfoServiceMock(buildAuth0Id: () => string) {
  return {
    getUserInfo: jest.fn().mockImplementation(() => {
      const sub = buildAuth0Id()
      return Promise.resolve({
        sub,
        email: mockAuth0EmailForSub(sub),
        name: "Test User",
        picture: "http://picture.url",
      })
    }),
  }
}

let mockTicketCounter = 0
export const mockInvitationSender = {
  sendInvitation: jest.fn().mockImplementation(() => {
    mockTicketCounter += 1
    return Promise.resolve({ ticketId: `ticket_${mockTicketCounter}` })
  }),
  resetTicketCounter: () => {
    mockTicketCounter = 0
  },
}

export const setupUserGuardForTesting = (
  moduleBuilder: TestingModuleBuilder,
  buildAuth0Id: () => string,
): TestingModuleBuilder => {
  const auth0UserInfoServiceMock = createAuth0UserInfoServiceMock(buildAuth0Id)
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
        request.user = { sub: buildAuth0Id() }
        return true
      },
    })
    .overrideProvider(Auth0UserInfoService)
    .useValue(auth0UserInfoServiceMock)
    .overrideProvider(INVITATION_SENDER)
    .useValue(mockInvitationSender)
}
