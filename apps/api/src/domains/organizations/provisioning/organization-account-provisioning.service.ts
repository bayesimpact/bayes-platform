import { Injectable, InternalServerErrorException } from "@nestjs/common"
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationMembershipsService } from "@/domains/organizations/memberships/organization-memberships.service"
import { Organization } from "@/domains/organizations/organization.entity"
import { User } from "@/domains/users/user.entity"

const PLACEHOLDER_AUTH0_ID_PREFIX = "00000000-0000-0000-0000-"

export type ProvisionOrganizationAccountInput = {
  auth0UserId: string
  email: string
  fullName?: string | null
  organizationName: string
}

export type ProvisionOrganizationAccountResult =
  | {
      status: "created"
      organizationId: string
      userId: string
    }
  | {
      status: "skipped_duplicate"
      organizationId: string
      userId: string
    }

@Injectable()
export class OrganizationAccountProvisioningService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly organizationMembershipsService: OrganizationMembershipsService,
  ) {}

  async provisionOrganizationAccount(
    input: ProvisionOrganizationAccountInput,
  ): Promise<ProvisionOrganizationAccountResult> {
    const normalizedEmail = input.email.trim().toLowerCase()
    const normalizedOrganizationName = input.organizationName.trim()

    return this.dataSource.transaction(async (manager) => {
      const organizationRepository = manager.getRepository(Organization)
      const userRepository = manager.getRepository(User)

      const user = await this.upsertUser({
        auth0UserId: input.auth0UserId,
        email: normalizedEmail,
        fullName: input.fullName,
        userRepository,
      })

      const existingOwnerMembership =
        await this.organizationMembershipsService.findOwnerMembershipByOrganizationName({
          userId: user.id,
          organizationName: normalizedOrganizationName,
        })

      if (existingOwnerMembership) {
        return {
          status: "skipped_duplicate",
          organizationId: existingOwnerMembership.organizationId,
          userId: user.id,
        }
      }

      const organization = organizationRepository.create({
        name: normalizedOrganizationName,
      })
      const savedOrganization = await organizationRepository.save(organization)

      await this.organizationMembershipsService.createOrganizationOwnerMembership({
        userId: user.id,
        organizationId: savedOrganization.id,
      })

      return {
        status: "created",
        organizationId: savedOrganization.id,
        userId: user.id,
      }
    })
  }

  async isAlreadyProvisioned(input: {
    auth0UserId: string
    email: string
    organizationName: string
  }): Promise<boolean> {
    const normalizedEmail = input.email.trim().toLowerCase()
    const normalizedOrganizationName = input.organizationName.trim()
    const user = await this.findUserByAuth0IdOrEmail({
      auth0UserId: input.auth0UserId,
      email: normalizedEmail,
    })
    if (!user) {
      return false
    }

    const membership =
      await this.organizationMembershipsService.findOwnerMembershipByOrganizationName({
        userId: user.id,
        organizationName: normalizedOrganizationName,
      })
    return Boolean(membership)
  }

  private async findUserByAuth0IdOrEmail(input: {
    auth0UserId: string
    email: string
  }): Promise<User | null> {
    const userByAuth0Id = await this.userRepository.findOne({
      where: { auth0Id: input.auth0UserId },
    })
    if (userByAuth0Id) {
      return userByAuth0Id
    }

    return this.userRepository.findOne({
      where: { email: input.email },
    })
  }

  private async upsertUser(input: {
    auth0UserId: string
    email: string
    fullName?: string | null
    userRepository: Repository<User>
  }): Promise<User> {
    const userByAuth0Id = await input.userRepository.findOne({
      where: { auth0Id: input.auth0UserId },
    })
    if (userByAuth0Id) {
      if (userByAuth0Id.email !== input.email) {
        userByAuth0Id.email = input.email
      }
      if (!userByAuth0Id.name && input.fullName) {
        userByAuth0Id.name = input.fullName
      }
      return input.userRepository.save(userByAuth0Id)
    }

    const userByEmail = await input.userRepository.findOne({
      where: { email: input.email },
    })
    if (userByEmail) {
      if (
        userByEmail.auth0Id !== input.auth0UserId &&
        !userByEmail.auth0Id.startsWith(PLACEHOLDER_AUTH0_ID_PREFIX)
      ) {
        throw new InternalServerErrorException(
          `Existing user with email ${input.email} has a different Auth0 ID`,
        )
      }

      userByEmail.auth0Id = input.auth0UserId
      if (!userByEmail.name && input.fullName) {
        userByEmail.name = input.fullName
      }
      return input.userRepository.save(userByEmail)
    }

    const createdUser = input.userRepository.create({
      auth0Id: input.auth0UserId,
      email: input.email,
      name: input.fullName ?? null,
      pictureUrl: null,
    })
    return input.userRepository.save(createdUser)
  }
}
