import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource } from "typeorm"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import type { OrganizationMembershipContextModel } from "@/domains/organizations/memberships/organization-membership.model"
import type { OrganizationMembershipRole } from "@/domains/organizations/memberships/organization-membership.types"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type { EndpointRequestWithOrganizationMembership } from "../request.interface"

@Injectable()
export class OrganizationContextResolver implements ContextResolver {
  readonly resource = "organization" as const

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithParams = request as ResolvableRequest & {
      params: { organizationId?: string }
    }
    const organizationId = requestWithParams.params?.organizationId
    if (!organizationId || organizationId === ":organizationId") {
      throw new BadRequestException(AUTH_ERRORS.NO_ORGANIZATION_ID)
    }

    const userMembership = await this.dataSource.getRepository(UserMembership).findOne({
      where: {
        userId: request.user.id,
        resourceId: organizationId,
        resourceType: "organization",
      },
    })
    if (!userMembership) {
      throw new UnauthorizedException(AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    }

    const organizationMembership = {
      id: userMembership.id,
      userId: userMembership.userId,
      organizationId,
      role: userMembership.role as OrganizationMembershipRole,
      createdAt: userMembership.createdAt,
      updatedAt: userMembership.updatedAt,
      deletedAt: userMembership.deletedAt,
    } satisfies OrganizationMembershipContextModel

    const requestWithMembership = request as EndpointRequestWithOrganizationMembership
    requestWithMembership.organizationId = organizationId
    requestWithMembership.organizationMembership = organizationMembership
  }
}
