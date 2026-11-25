import {
  DESK_UI_READ_PERMISSION,
  type MyOrganizationOutputDto,
  type MyProjectOutputDto,
  myOrganizationOutputSchema,
  myProjectOutputSchema,
  PROJECT_READ_PERMISSION,
  SOURCES_TOOL_FEATURE_FLAG,
} from "@caseai-connect/desk-contracts"

/** An organization of `GET desk/organizations/mine`, checked against the contract. */
export function buildMyOrganization(
  overrides: Partial<MyOrganizationOutputDto> = {},
): MyOrganizationOutputDto {
  return myOrganizationOutputSchema.parse({
    id: crypto.randomUUID(),
    name: "Product",
    ...overrides,
  })
}

/** A project of `GET desk/projects/mine`, which opens the Desk unless `permissions` says otherwise. */
export function buildMyProject(
  organization: MyOrganizationOutputDto,
  overrides: Partial<MyProjectOutputDto> = {},
): MyProjectOutputDto {
  return myProjectOutputSchema.parse({
    id: crypto.randomUUID(),
    name: "Pricing",
    organizationId: organization.id,
    permissions: [PROJECT_READ_PERMISSION, DESK_UI_READ_PERMISSION],
    featureFlags: [SOURCES_TOOL_FEATURE_FLAG],
    ...overrides,
  })
}
