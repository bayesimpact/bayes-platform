import {
  EVALUATION_UI_READ_PERMISSION,
  type MyOrganizationOutputDto,
  type MyProjectOutputDto,
  myOrganizationOutputSchema,
  myProjectOutputSchema,
  PROJECT_READ_PERMISSION,
} from "@bayes-platform/eval-contracts"

/** An organization of `GET eval/organizations/mine`, checked against the contract. */
export function buildMyOrganization(
  overrides: Partial<MyOrganizationOutputDto> = {},
): MyOrganizationOutputDto {
  return myOrganizationOutputSchema.parse({
    id: crypto.randomUUID(),
    name: "Product",
    ...overrides,
  })
}

/** A project of `GET eval/projects/mine`, which the person can evaluate unless `permissions` says otherwise. */
export function buildMyProject(
  organization: MyOrganizationOutputDto,
  overrides: Partial<MyProjectOutputDto> = {},
): MyProjectOutputDto {
  return myProjectOutputSchema.parse({
    id: crypto.randomUUID(),
    name: "Pricing",
    organizationId: organization.id,
    permissions: [PROJECT_READ_PERMISSION, EVALUATION_UI_READ_PERMISSION],
    ...overrides,
  })
}
