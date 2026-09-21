import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { normalizeAuth0Name } from "@/domains/auth/auth0-userinfo.helper"
import type { Auth0UserInfoResponse } from "@/domains/auth/auth0-userinfo.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserMembershipRepository } from "@/domains/memberships/user-membership.repository"
import { resolveOrganizationRoleId } from "@/domains/rbac/resolve-organization-role-id"
import {
  buildServiceUserAuth0Id,
  buildServiceUserEmail,
  isServiceAuth0Id,
  isServiceUser,
  isServiceUserEmail,
} from "./service-user.helpers"
import { User } from "./user.entity"
import { USER_TYPE_HUMAN, USER_TYPE_SERVICE } from "./user.types"

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly transactionService: TransactionService,
    private readonly userMembershipRepository: UserMembershipRepository,
  ) {}

  async findByAuth0Id(auth0Id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { auth0Id } })
  }
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } })
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } })
  }

  async create(auth0UserInfo: Auth0UserInfoResponse): Promise<User> {
    // Ensure email is provided (required field)
    if (!auth0UserInfo.email) {
      throw new Error("Email is required from Auth0 token")
    }
    this.assertHumanAuth0Login({ sub: auth0UserInfo.sub, email: auth0UserInfo.email })

    const user = this.userRepository.create({
      auth0Id: auth0UserInfo.sub,
      email: auth0UserInfo.email,
      name: auth0UserInfo.name || null,
      pictureUrl: auth0UserInfo.picture || null,
      type: USER_TYPE_HUMAN,
    })

    return this.userRepository.save(user)
  }

  async createServiceUser(params: { appSlug: string; installationId: string }): Promise<User> {
    return this.userRepository.save(
      this.userRepository.create({
        auth0Id: buildServiceUserAuth0Id(params.installationId),
        email: buildServiceUserEmail(params.appSlug, params.installationId),
        name: params.appSlug,
        pictureUrl: null,
        type: USER_TYPE_SERVICE,
      }),
    )
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

    await this.transactionService.run(async () => {
      const organizationRoleId = await resolveOrganizationRoleId(
        this.transactionService.getManager(),
        "member",
      )

      await this.userMembershipRepository.insertMembership({
        userId: params.userId,
        resourceType: "organization",
        resourceId: params.organizationId,
        role: "member",
        roleId: organizationRoleId,
      })
      await this.userMembershipRepository.insertMembership({
        userId: params.userId,
        resourceType: "project",
        resourceId: params.projectId,
        role: "member",
        roleId: params.customRoleId,
      })
    })
  }

  async updateUser(userId: string, name: string): Promise<User> {
    await this.userRepository.update(userId, { name })
    const updated = await this.findById(userId)
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
        return this.userRepository.save({
          ...user,
          auth0Id: auth0UserInfo.sub, // Link existing user to Auth0 ID
          name: normalizeAuth0Name(auth0UserInfo.name, auth0UserInfo.email),
          picture: auth0UserInfo.picture,
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
