import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource } from "typeorm"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import type { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
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

    // TODO (cleanup PR): once OrganizationMembership is removed, narrow the
    // request-interface type for organizationMembership to a Pick of only what
    // policies actually read (organizationId, role today), drop the `as` cast
    // below, and load the `user` relation only if a policy starts needing it.
    //
    // The `as OrganizationMembership` below is intentional: we build a plain
    // DTO from user_membership rows rather than a real entity instance, so the
    // `user` relation field is absent. TypeScript would reject
    // `satisfies OrganizationMembership` because of that missing field. At
    // runtime this is safe — BasePolicy only reads
    // `organizationMembership.organizationId` and `organizationMembership.role`;
    // the relation field is never accessed.
    const organizationMembership = {
      id: userMembership.id,
      userId: userMembership.userId,
      organizationId,
      role: userMembership.role,
      createdAt: userMembership.createdAt,
      updatedAt: userMembership.updatedAt,
      deletedAt: userMembership.deletedAt,
    } as OrganizationMembership

    const requestWithMembership = request as EndpointRequestWithOrganizationMembership
    requestWithMembership.organizationId = organizationId
    requestWithMembership.organizationMembership = organizationMembership
  }
}
