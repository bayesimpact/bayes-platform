import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { normalizeAuth0Name } from "@/domains/auth/auth0-userinfo.helper"
import type { Auth0UserInfoResponse } from "@/domains/auth/auth0-userinfo.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserMembershipRepository } from "@/domains/memberships/user-membership.repository"
import {
  buildServiceUserAuth0Id,
  buildServiceUserEmail,
  isServiceAuth0Id,
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

  async findByAuth0Id(auth0Id: string): Promise<User | null> {
    return this.userRepository.findByAuth0Id(auth0Id)
  }
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email)
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id)
  }

  async create(auth0UserInfo: Auth0UserInfoResponse): Promise<User> {
    if (!auth0UserInfo.email) {
      throw new Error("Email is required from Auth0 token")
    }
    this.assertHumanAuth0Login({ sub: auth0UserInfo.sub, email: auth0UserInfo.email })

    return this.userRepository.createUser({
      auth0Id: auth0UserInfo.sub,
      email: auth0UserInfo.email,
      name: auth0UserInfo.name || null,
      pictureUrl: auth0UserInfo.picture || null,
      type: USER_TYPE_HUMAN,
    })
  }

  async createServiceUser(params: { appSlug: string; installationId: string }): Promise<User> {
    return this.userRepository.createUser({
      auth0Id: buildServiceUserAuth0Id(params.installationId),
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

  async findOrCreate({
    sub,
    getUserInfo,
  }: {
    sub: Auth0UserInfoResponse["sub"]
    getUserInfo: () => Promise<Auth0UserInfoResponse>
  }): Promise<User> {
    this.assertHumanAuth0Login({ sub })

    let user = await this.findByAuth0Id(sub)
    this.assertHumanAuth0Login({ sub, user })

    if (!user) {
      const auth0UserInfo = await getUserInfo()

      if (!auth0UserInfo.email) {
        throw new UnauthorizedException("Email is required from Auth0 token")
      }
      this.assertHumanAuth0Login({ sub: auth0UserInfo.sub, email: auth0UserInfo.email })

      user = await this.findByEmail(auth0UserInfo.email)
      this.assertHumanAuth0Login({ sub: auth0UserInfo.sub, email: auth0UserInfo.email, user })

      if (user) {
        return this.userRepository.linkAuth0Identity({
          user,
          auth0Id: auth0UserInfo.sub,
          name: normalizeAuth0Name(auth0UserInfo.name, auth0UserInfo.email) ?? null,
          pictureUrl: auth0UserInfo.picture || null,
        })
      }

      user = await this.create({
        sub: auth0UserInfo.sub,
        email: auth0UserInfo.email,
        name: normalizeAuth0Name(auth0UserInfo.name, auth0UserInfo.email),
        picture: auth0UserInfo.picture,
      })
    }
    return user
  }

  private assertHumanAuth0Login(params: { sub: string; email?: string; user?: User | null }): void {
    if (
      isServiceAuth0Id(params.sub) ||
      (params.email !== undefined && isServiceUserEmail(params.email)) ||
      (params.user != null && isServiceUser(params.user))
    ) {
      throw new UnauthorizedException(AUTH_ERRORS.SERVICE_USERS_CANNOT_AUTHENTICATE)
    }
  }
}
