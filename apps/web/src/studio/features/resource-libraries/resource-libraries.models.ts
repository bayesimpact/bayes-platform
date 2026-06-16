import type {
  CreateResourceDto,
  ResourceDto,
  ResourceFileDto,
  ResourceLibraryDto,
} from "@caseai-connect/api-contracts"

export type ResourceLibrary = ResourceLibraryDto

export type Resource = ResourceDto

// Editable resource fields without the server-managed id, used for add/update payloads.
export type ResourceFields = CreateResourceDto

export type ResourceFile = ResourceFileDto
