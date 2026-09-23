import { UnauthorizedException } from "@nestjs/common"
import type { ConfigService } from "@nestjs/config"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { AppJwtService } from "./app-jwt.service"

function configStub(): ConfigService {
  return {
    getOrThrow: (key: string) => {
      const value = process.env[key]
      if (!value) throw new Error(`missing ${key}`)
      return value
    },
    get: (key: string) => process.env[key],
  } as unknown as ConfigService
}

describe("AppJwtService", () => {
  it("signs and verifies an App JWT", () => {
    const service = new AppJwtService(configStub())
    const token = service.sign({
      subject: "user-1",
      projectId: "project-1",
      installationId: "install-1",
    })
    expect(service.verify(token)).toMatchObject({
      sub: "user-1",
      project_id: "project-1",
      installation_id: "install-1",
    })
  })

  it("maps an invalid token to UnauthorizedException", () => {
    const service = new AppJwtService(configStub())
    try {
      service.verify("not-a-jwt")
      throw new Error("expected UnauthorizedException")
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException)
      expect((error as UnauthorizedException).message).toBe(AUTH_ERRORS.INVALID_ACCESS_TOKEN)
    }
  })
})
