import { Global, Module } from "@nestjs/common"
import { CustomModelRepository } from "./custom-model.repository"
import { MODEL_ENDPOINT_RESOLVER } from "./model-endpoint.types"
import { ProjectModelRepository } from "./project-model.repository"
import { WorkspaceModelsService } from "./workspace-models.service"

/**
 * Global, so the LLM providers find the resolver wherever `LlmModule` is imported, as long as the
 * application (API or workers) imports this module once. A test module without it leaves the
 * providers on the environment variables.
 */
@Global()
@Module({
  providers: [
    ProjectModelRepository,
    CustomModelRepository,
    WorkspaceModelsService,
    { provide: MODEL_ENDPOINT_RESOLVER, useExisting: WorkspaceModelsService },
  ],
  exports: [WorkspaceModelsService, MODEL_ENDPOINT_RESOLVER],
})
export class WorkspaceModelsModule {}
