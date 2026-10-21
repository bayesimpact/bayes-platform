import {
  DESK_UI_READ_PERMISSION,
  type MyOrganizationOutputDto,
  type MyProjectOutputDto,
  myOrganizationOutputSchema,
  myProjectOutputSchema,
} from "@caseai-connect/desk-contracts"

/** An organization of `GET organizations/mine`, checked against the contract. */
function buildMyOrganization(
  overrides: Partial<MyOrganizationOutputDto> = {},
): MyOrganizationOutputDto {
  return myOrganizationOutputSchema.parse({
    id: crypto.randomUUID(),
    name: "Product",
    ...overrides,
  })
}

/** A project of `GET projects/mine`, which opens the Desk unless `permissions` says otherwise. */
function buildMyProject(
  organization: MyOrganizationOutputDto,
  overrides: Partial<MyProjectOutputDto> = {},
): MyProjectOutputDto {
  return myProjectOutputSchema.parse({
    id: crypto.randomUUID(),
    name: "Pricing",
    organizationId: organization.id,
    permissions: ["project.read", DESK_UI_READ_PERMISSION],
    ...overrides,
  })
}

/** Two organizations: three projects open the Desk, and one, "Billing", does not. */
export function buildHomeWorld() {
  const product = buildMyOrganization({ name: "Product" })
  const operations = buildMyOrganization({ name: "Operations" })
  return {
    organizations: [product, operations],
    projects: [
      buildMyProject(product, { name: "Support" }),
      buildMyProject(product, { name: "Pricing" }),
      buildMyProject(product, { name: "Billing", permissions: ["project.read"] }),
      buildMyProject(operations, { name: "Help center" }),
    ],
  }
}
