import {
  EVALUATION_UI_READ_PERMISSION,
  type MyProjectOutputDto,
  myProjectOutputSchema,
} from "@caseai-connect/eval-contracts"

/** A project of `GET projects/mine`, which the person can evaluate unless `permissions` says otherwise. */
export function buildMyProject(overrides: Partial<MyProjectOutputDto> = {}): MyProjectOutputDto {
  return myProjectOutputSchema.parse({
    id: crypto.randomUUID(),
    name: "Pricing",
    organizationId: crypto.randomUUID(),
    permissions: ["project.read", EVALUATION_UI_READ_PERMISSION],
    ...overrides,
  })
}
