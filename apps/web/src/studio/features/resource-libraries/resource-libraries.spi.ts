import type { ResourceFields, ResourceFile, ResourceLibrary } from "./resource-libraries.models"

type ProjectScope = { organizationId: string; projectId: string }
type ResourceLibraryScope = ProjectScope & { resourceLibraryId: string }
type ResourceScope = ResourceLibraryScope & { resourceId: string }
type ResourceLibraryFields = { title: string }

export interface IResourceLibrariesSpi {
  getAll: (params: ProjectScope) => Promise<ResourceLibrary[]>
  createOne: (params: ProjectScope, payload: ResourceLibraryFields) => Promise<ResourceLibrary>
  updateOne: (params: ResourceLibraryScope, payload: ResourceLibraryFields) => Promise<void>
  deleteOne: (params: ResourceLibraryScope) => Promise<void>
  addResource: (params: ResourceLibraryScope, payload: ResourceFields) => Promise<ResourceLibrary>
  updateResource: (params: ResourceScope, payload: ResourceFields) => Promise<ResourceLibrary>
  deleteResource: (params: ResourceScope) => Promise<void>
  uploadResourceFile: (params: ProjectScope, file: File) => Promise<ResourceFile>
}
