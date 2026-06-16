import type { Resource, ResourceFile, ResourceLibrary } from "./resource-libraries.models"

type ProjectScope = { organizationId: string; projectId: string }
type ResourceLibraryScope = ProjectScope & { resourceLibraryId: string }
type ResourceLibraryFields = { title: string; resources: Resource[] }

export interface IResourceLibrariesSpi {
  getAll: (params: ProjectScope) => Promise<ResourceLibrary[]>
  createOne: (params: ProjectScope, payload: ResourceLibraryFields) => Promise<ResourceLibrary>
  updateOne: (params: ResourceLibraryScope, payload: ResourceLibraryFields) => Promise<void>
  deleteOne: (params: ResourceLibraryScope) => Promise<void>
  uploadResourceFile: (params: ProjectScope, file: File) => Promise<ResourceFile>
}
