# ADR 0020: TypeORM Stays Inside Custom Repositories

* **Status**: Accepted
* **Date**: 2026-09-29
* **Deciders**: engineering
* **Scope**: `apps/api` services, custom repositories, and `TransactionService`

---

## 1. Context and Problem Statement

Feature services inject TypeORM's `Repository<T>`, call `find` / `save` / query builders, and sometimes construct `ConnectRepository` themselves. The same class then owns business rules and SQL. New code copies that shape because the older services are the nearest example.

That is an architecture problem. The service stops being a boundary: its callers, its collaborators, and its tests all speak TypeORM. Three failures follow.

### 1.1 A transaction is an argument the caller can drop

When the service holds the connection, the only way for a second write to join the first is to pass the `EntityManager` down. The parameter is optional, so the type checker accepts the call that forgets it, and the two writes commit on different connections.

`InvitationPersistenceService` takes `manager?: EntityManager` on every method and falls back to the injected repository when the argument is missing. `ProjectInvitationHandler.inviteOneMember` passes the manager from its transaction. `InvitationsService` then calls `markAcceptedByToken(ticketId)` with no manager, after `acceptanceHandler.acceptInvitation` has already returned. Accepting the invitation and marking the token accepted are two units of work. Nothing in the signature says they had to be one. The next caller copies the optional parameter and omits it.

The same parameter becomes another service's API. `BaseAgentSessionsService.deleteAgentSession` opens `dataSource.transaction` and hands the manager to `ConversationFormsService.deleteForSession`. Every other write in the forms service goes through `ConnectRepository`; this one method exists only to delete with a manager the caller supplies. `ConversationAgentSessionPurgeService` calls it too, and because that service must not import `PublicAgentSession` it loads the row with `entityManager.findOne("PublicAgentSession", ...)`. The transaction opened in the service is why one domain names another domain's entity as a string.

### 1.2 The business rule and the SQL are the same function

A reader cannot see the rule without reading the query, and cannot change the query without risking the rule.

`AgentCsvExtractionRunProcessorService.recomputeSummaryAndMaybeComplete` decides whether a run failed or completed, and which worker owns the CSV export, inside a callback that also takes a pessimistic lock and repeats `organization_id` / `project_id` as raw column predicates. Reusing the status count means copying that callback.

`DocumentTagsService` refuses to delete the public-documents tag, then runs `documentTagRepository.manager.query("DELETE FROM document_document_tag ...")` on the default connection, then deletes the tag through `ConnectRepository`. The rule, the join-table SQL, and a second connection sit in one method. The two deletes are separate units of work.

`AgentSettingsService.get` loads through `ConnectRepository`, which applies organization and project. `getMaxRevision` on the same class uses `createQueryBuilder` and filters on `agentId` only. Scope is a local choice, so two methods in one service can disagree about which rows exist.

### 1.3 Every service re-implements persistence

`AgentCsvExtractionRunStarterService` injects four `Repository<T>` and builds four `ConnectRepository` wrappers in its constructor. The wrapper, the scope columns, and the entity are visible to a class whose job is starting a run. The next service that touches those tables copies the constructor. There is no single place that owns how an extraction run is stored.

A service written this way cannot be tested by returning a value. A stub has to implement `createQueryBuilder().setLock().where().andWhere().getOne()`, or the test hits a database and asserts SQL. The method list of a custom repository is a value the test can return.

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

* **`@InjectRepository` in the service.** Rejected. This is the shape in §1.2 and §1.3: the service API is TypeORM's API, scope is re-decided per method, and a transaction manager cannot be substituted without threading it through every call.
* **Passing `EntityManager` into every service method.** Rejected. This is the shape in §1.1. Call sites drop the argument, and two methods in one request write on different managers. Collaborators grow a second entry point whose only input is a manager.
* **A generic repository with `find` / `save` forwarded.** Rejected. That leaks TypeORM into the service under another name. The method list is the contract, which is also what a test can stub.

## 4. Consequences

* New persistence is a repository method plus a service call. Existing services that still inject `Repository<T>` are legacy and are not the pattern to copy.
* A repository method is easy to call from a transaction without a new parameter, because the manager is ambient.
* Connect scoping has one implementation, inside the repository that owns the entity.

## 5. References

The pattern:

* `apps/api/src/domains/agents/agent.repository.ts`
* `apps/api/src/domains/projects/project.repository.ts`
* `apps/api/src/domains/rbac/platform-role.repository.ts`
* `apps/api/src/domains/evaluations/extraction/datasets/evaluation-extraction-dataset-document.repository.ts`
* `.cursor/rules/api-custom-repositories.mdc`

The legacy shapes cited in §1:

* `apps/api/src/domains/invitations/invitation-persistence.service.ts`
* `apps/api/src/domains/agents/base-agent-sessions/base-agent-sessions.service.ts`
* `apps/api/src/domains/agents/conversation-agent-sessions/retention/conversation-agent-session-purge.service.ts`
* `apps/api/src/domains/agents/csv-extraction-runs/agent-csv-extraction-run-processor.service.ts`
* `apps/api/src/domains/documents/tags/document-tags.service.ts`
* `apps/api/src/domains/agents/settings/agent-settings.service.ts`
* `apps/api/src/domains/agents/csv-extraction-runs/agent-csv-extraction-run-starter.service.ts`
