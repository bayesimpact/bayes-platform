# ADR 0020: TypeORM Stays Inside Custom Repositories

* **Status**: Accepted
* **Date**: 2026-09-29
* **Deciders**: engineering
* **Scope**: `apps/api` services, custom repositories, and `TransactionService`

---

## 1. Context and Problem Statement

Feature services inject TypeORM's `Repository<T>`, call `find` / `save` / query builders, and sometimes construct `ConnectRepository` themselves. The same service then owns business rules and SQL. A method that should join an ambient transaction takes an `EntityManager` argument, and callers forget to pass the one `TransactionService.run()` opened.

New code still copies that shape because the older services are the nearest example.

## 2. Decision

**A service never imports TypeORM. An `{Entity}Repository` Nest provider is the only persistence API the service sees.**

### 2.1 The repository owns the manager

The repository is `@Injectable()` and takes `TransactionService`. Each method calls `transactionService.getManager().getRepository(Entity)` when it runs. `getManager()` returns the `EntityManager` stored for the current `transactionService.run()`, and the default manager otherwise. Nested `run()` calls join the outer transaction. The repository does not take an `EntityManager` parameter and does not open its own transaction.

`TransactionService` is a value import. A type-only import is undefined when Nest instantiates the class.

### 2.2 The public API is named methods

Callers see `createProject`, `findSummariesByProject`, `softDelete`. They do not see `Repository<T>`, `SelectQueryBuilder`, find operators, or `EntityManager`. Arguments and return values are plain values, records, or the entity.

Raw SQL, when a query builder is the wrong tool, still goes through `getManager().query()` inside the repository.

### 2.3 Connect scope stays inside

For an entity scoped by `organizationId` and `projectId`, the repository constructs `ConnectRepository` around `repo()`. The service passes `connectScope: RequiredConnectScope` into the named method. The service does not build the wrapper and does not repeat the scope columns in a `where`.

### 2.4 Wiring

The domain module lists the repository in `providers`, and in `exports` when another module injects it. `TypeOrmModule.forFeature` can stay so Nest still knows the entity. The service injects the custom class only.

Work that must commit or roll back together is wrapped in `transactionService.run()` in the service. Every repository method called from that callback shares the transaction.

## 3. Alternatives Considered

* **`@InjectRepository` in the service.** Rejected. The service becomes coupled to TypeORM's API, and a transaction manager cannot be substituted without threading it through every call.
* **Passing `EntityManager` into every service method.** Rejected. Call sites drop it, and two methods in one request write on different managers.
* **A generic repository with `find` / `save` forwarded.** Rejected. That leaks TypeORM into the service under another name. The method list is the contract.

## 4. Consequences

* New persistence is a repository method plus a service call. Existing services that still inject `Repository<T>` are legacy and are not the pattern to copy.
* A repository method is easy to call from a transaction without a new parameter, because the manager is ambient.
* Connect scoping has one implementation, inside the repository that owns the entity.

## 5. References

* `apps/api/src/domains/agents/agent.repository.ts`
* `apps/api/src/domains/projects/project.repository.ts`
* `apps/api/src/domains/rbac/platform-role.repository.ts`
* `apps/api/src/domains/evaluations/extraction/datasets/evaluation-extraction-dataset-document.repository.ts`
* `.cursor/rules/api-custom-repositories.mdc`
