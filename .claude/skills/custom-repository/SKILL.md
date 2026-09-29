---
name: custom-repository
description: Add a custom entity repository so a NestJS service never touches TypeORM. Use when persisting from a service, adding a repository method, or moving a TypeORM query out of a service.
---

# Custom repository

Services do not use TypeORM. Persistence goes through an `@Injectable()` `{Entity}Repository` whose public methods are named for the operation. The repository reads the TypeORM manager from `TransactionService` at call time, so a call inside `transactionService.run()` joins that transaction.

This skill explains how to add one. It does not replace:

- `.cursor/rules/api-custom-repositories.mdc` — the rule Cursor applies on service and repository files
- `.claude/skills/crud-generator/SKILL.md` — emits a repository as part of full CRUD boilerplate
- [ADR 0020](../../../docs/adr/0020-custom-repositories.md) — why TypeORM stays out of services

Many existing services still inject `Repository<T>`. Do not copy them.

## Add a repository

Create `apps/api/src/domains/{domain}/{entity}.repository.ts`:

```typescript
import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { Project } from "./project.entity"

export type ProjectRecord = {
  id: string
  organizationId: string
  name: string
}

@Injectable()
export class ProjectRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async createProject(params: { organizationId: string; name: string }): Promise<ProjectRecord> {
    const saved = await this.repo().save(this.repo().create(params))
    return { id: saved.id, organizationId: saved.organizationId, name: saved.name }
  }

  private repo(): Repository<Project> {
    return this.transactionService.getManager().getRepository(Project)
  }
}
```

Rules for that file:

- `TransactionService` is a value import with the biome-ignore comment. A type-only import is undefined at runtime and Nest cannot inject it.
- Call `getManager().getRepository(Entity)` inside the method (via a private `repo()`), not in the constructor. `getManager()` returns the manager stored for the current `transactionService.run()`, or the default manager outside one.
- Public methods take and return plain values, records, or the entity. They do not accept or return `Repository<T>`, `SelectQueryBuilder`, `FindOperator`, or `EntityManager`.
- Name the method for the operation (`createProject`, `findSummariesByProject`, `softDelete`). Do not expose `find`, `save`, or `create`.
- Raw SQL, when it is needed, uses `this.transactionService.getManager().query(...)` so it joins the same transaction. See `platform-role.repository.ts`.

Register the class in the domain module `providers`. Add it to `exports` when another module injects it. `ProjectRepository` is both, in `projects.module.ts`.

Leave `TypeOrmModule.forFeature([Entity])` as it is if the module already has it. The custom repository does not replace that registration; it stops the service from injecting the TypeORM repository.

## Connect-scoped entities

`ConnectRepository` wraps the TypeORM repository and applies `organizationId` / `projectId`. Construct it inside the custom repository. The service passes `connectScope` and never builds the wrapper itself.

```typescript
createPending(
  connectScope: RequiredConnectScope,
  fields: CreateEvaluationExtractionDatasetDocumentFields,
): Promise<EvaluationExtractionDatasetDocument> {
  return this.connectRepo().createAndSave(connectScope, { ...fields, uploadStatus: "pending" })
}

private connectRepo(): ConnectRepository<EvaluationExtractionDatasetDocument> {
  return new ConnectRepository(this.repo(), "evaluationExtractionDatasetDocument")
}
```

Reference: `evaluation-extraction-dataset-document.repository.ts`.

## Call it from the service

```typescript
@Injectable()
export class ProjectsService {
  constructor(private readonly projectRepository: ProjectRepository) {}

  createProject(params: { organizationId: string; name: string }) {
    return this.projectRepository.createProject(params)
  }
}
```

`ProjectRepository` is a value import with the same biome-ignore comment.

Work that must commit or roll back together goes in `transactionService.run()` in the service. Repository methods called from that callback share the transaction. Do not start a second transaction inside the repository.

```typescript
await this.transactionService.run(async () => {
  const project = await this.projectRepository.createProject(params)
  await this.projectMembershipRepository.createOwner(project.id, params.userId)
})
```

## Do not

- `import ... from "typeorm"` or `@nestjs/typeorm` in a service
- `@InjectRepository`, `Repository<T>`, `find` / `save` / `create` / `In()`, or a query builder in a service
- `new ConnectRepository(...)` in a service
- A public repository method whose parameters or return type are TypeORM types

## References

- `apps/api/src/domains/agents/agent.repository.ts` — summaries, ids, soft delete
- `apps/api/src/domains/projects/project.repository.ts` — records in, models out
- `apps/api/src/domains/rbac/platform-role.repository.ts` — SQL on `getManager()`
- `apps/api/src/domains/evaluations/extraction/datasets/evaluation-extraction-dataset-document.repository.ts` — connect scope
