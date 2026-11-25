import type { OrganizationPermission, TimeType } from "@bayes-platform/api-contracts"
import { ModelWithPermissions } from "@/common/models/model-with-permissions"
import type { Organization } from "./organization.entity"

export class OrganizationModel extends ModelWithPermissions<OrganizationPermission> {
  readonly id: string
  readonly name: string
  readonly createdAt: TimeType

  constructor(
    props: { id: string; name: string; createdAt: TimeType },
    permissions: readonly string[],
  ) {
    super(permissions)
    this.id = props.id
    this.name = props.name
    this.createdAt = props.createdAt
  }

  static fromEntity(organization: Organization, permissions: readonly string[]): OrganizationModel {
    return new OrganizationModel(
      {
        id: organization.id,
        name: organization.name,
        createdAt: organization.createdAt.getTime(),
      },
      permissions,
    )
  }
}
