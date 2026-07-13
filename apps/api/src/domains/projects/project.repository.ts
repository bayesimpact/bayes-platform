import { Injectable } from "@nestjs/common"
import { ALL_ENTITIES } from "@/common/all-entities"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { Project } from "./project.entity"

@Injectable()
export class ProjectRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async softDelete(projectId: string): Promise<void> {
    const entityManager = this.transactionService.getManager()

    for (const entity of ALL_ENTITIES) {
      const hasProjectId = entityManager.connection
        .getMetadata(entity)
        .columns.some((column) => column.propertyName === "projectId")
      if (hasProjectId) {
        await entityManager.softDelete(entity, { projectId })
      }
    }

    await entityManager.softDelete(Project, { id: projectId })
  }
}
