import {
  EVALUATION_UI_READ_PERMISSION,
  type MyOrganizationOutputDto,
  type MyProjectOutputDto,
  myOrganizationOutputSchema,
  myProjectOutputSchema,
} from "@caseai-connect/eval-contracts"

/** An organization of `GET organizations/mine`, checked against the contract. */
export function buildMyOrganization(
  overrides: Partial<MyOrganizationOutputDto> = {},
): MyOrganizationOutputDto {
  return myOrganizationOutputSchema.parse({
    id: crypto.randomUUID(),
    name: "Product",
    ...overrides,
  })
}

/** A project of `GET projects/mine`, which the person can evaluate unless `permissions` says otherwise. */
export function buildMyProject(
  organization: MyOrganizationOutputDto,
  overrides: Partial<MyProjectOutputDto> = {},
): MyProjectOutputDto {
  return myProjectOutputSchema.parse({
    id: crypto.randomUUID(),
    name: "Pricing",
    organizationId: organization.id,
    permissions: ["project.read", EVALUATION_UI_READ_PERMISSION],
    ...overrides,
  })
}
