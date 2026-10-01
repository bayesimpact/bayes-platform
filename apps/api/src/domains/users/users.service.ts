import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { getOidcEmailLinkingPolicy, type OidcEmailLinkingPolicy } from "@/domains/auth/oidc-config"
import { normalizeOidcName, type OidcUserInfo } from "@/domains/auth/oidc-userinfo.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserMembershipRepository } from "@/domains/memberships/user-membership.repository"
import {
  buildServiceUserAuthSubject,
  buildServiceUserEmail,
  isServiceAuthSubject,
  isServiceUser,
  isServiceUserEmail,
} from "./service-user.helpers"
import type { User } from "./user.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserRepository } from "./user.repository"
import { USER_TYPE_HUMAN, USER_TYPE_SERVICE } from "./user.types"

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userMembershipRepository: UserMembershipRepository,
  ) {}

  async findByAuthSubject(authSubject: string): Promise<User | null> {
    return this.userRepository.findByAuthSubject(authSubject)
  }
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email)
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id)
  }

  /**
   * Returns the human account for this email, creating one that has never
   * signed in when the email is unknown. Access given to it is picked up at
   * the person's first OIDC sign-in with the same email.
   */
  async findOrCreateByEmail(params: { email: string; name?: string | null }): Promise<User> {
    const email = normalizeEmail(params.email)
    const existingUser = await this.userRepository.findByEmail(email)
    if (existingUser) return existingUser
    return this.userRepository.createUser({
      authSubject: null,
      email,
      name: params.name?.trim() || null,
      pictureUrl: null,
      type: USER_TYPE_HUMAN,
    })
  }

  async createServiceUser(params: { appSlug: string; installationId: string }): Promise<User> {
    return this.userRepository.createUser({
      authSubject: buildServiceUserAuthSubject(params.installationId),
      email: buildServiceUserEmail(params.appSlug, params.installationId),
      name: params.appSlug,
      pictureUrl: null,
      type: USER_TYPE_SERVICE,
    })
  }

  /**
   * Attaches the install identity: `org_member` on the organization plus a
   * project membership whose legacy role stays `"member"` and whose `roleId`
   * is the installation custom role (created in the install ticket).
   */
  async attachServiceUserMemberships(params: {
    userId: string
    organizationId: string
    projectId: string
    customRoleId: string
  }): Promise<void> {
    const user = await this.findById(params.userId)
    if (!user || !isServiceUser(user)) {
      throw new BadRequestException("Only service users can be attached as app installations")
    }

    await this.userMembershipRepository.insertServiceUserInstallMemberships(params)
  }

  async updateUser(userId: string, name: string): Promise<User> {
    const updated = await this.userRepository.updateName(userId, name)
    if (!updated) throw new Error(`User ${userId} not found after update`)
    return updated
  }

  /**
   * Resolves the account behind an OIDC sign-in.
   *
   * A known `sub` is enough. On a first sign-in the userinfo claims decide:
   * an existing account with the same email (someone added by email, or an
   * account moved from another provider) is linked when the provider reports
   * the email as verified and linking is allowed; otherwise a new account
   * without any access is created.
   */
  async findOrCreate({
    sub,
    getUserInfo,
    emailLinkingPolicy = getOidcEmailLinkingPolicy(),
  }: {
    sub: OidcUserInfo["sub"]
    getUserInfo: () => Promise<OidcUserInfo>
    emailLinkingPolicy?: OidcEmailLinkingPolicy
  }): Promise<User> {
    this.assertHumanLogin({ sub })

    const knownUser = await this.findByAuthSubject(sub)
    this.assertHumanLogin({ sub, user: knownUser })
    if (knownUser) return knownUser

    const oidcUserInfo = await getUserInfo()
    if (oidcUserInfo.sub !== sub) {
      // OpenID Connect Core 1.0, section 5.3.2: the userinfo `sub` must match the token's.
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_ACCESS_TOKEN)
    }
    if (!oidcUserInfo.email) {
      throw new UnauthorizedException(AUTH_ERRORS.EMAIL_REQUIRED)
    }
    const email = normalizeEmail(oidcUserInfo.email)
    this.assertHumanLogin({ sub, email })

    const name = normalizeOidcName(oidcUserInfo.name, email) ?? null
    const pictureUrl = oidcUserInfo.picture || null

    const userWithSameEmail = await this.findByEmail(email)
    this.assertHumanLogin({ sub, email, user: userWithSameEmail })

    if (userWithSameEmail) {
      if (!emailLinkingPolicy.allowEmailLinking) {
        throw new UnauthorizedException(AUTH_ERRORS.EMAIL_LINKING_DISABLED)
      }
      if (oidcUserInfo.email_verified !== true && !emailLinkingPolicy.trustUnverifiedEmail) {
        throw new UnauthorizedException(AUTH_ERRORS.EMAIL_NOT_VERIFIED)
      }
      return this.userRepository.linkIdentity({
        user: userWithSameEmail,
        authSubject: sub,
        name,
        pictureUrl,
      })
    }

    return this.userRepository.createUser({
      authSubject: sub,
      email,
      name,
      pictureUrl,
      type: USER_TYPE_HUMAN,
    })
  }

  private assertHumanLogin(params: { sub: string; email?: string; user?: User | null }): void {
    if (
      isServiceAuthSubject(params.sub) ||
      (params.email !== undefined && isServiceUserEmail(params.email)) ||
      (params.user != null && isServiceUser(params.user))
    ) {
      throw new UnauthorizedException(AUTH_ERRORS.SERVICE_USERS_CANNOT_AUTHENTICATE)
    }
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
