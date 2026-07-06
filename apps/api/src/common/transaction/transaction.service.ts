import { AsyncLocalStorage } from "node:async_hooks"
import { Injectable } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import type { DataSource, EntityManager } from "typeorm"

/**
 * TransactionService — ambient transaction management via AsyncLocalStorage.
 *
 * ## How it works
 *
 * `run(fn)` opens a TypeORM transaction, stores the active `EntityManager`
 * inside Node's `AsyncLocalStorage`, then executes `fn`. Because
 * `AsyncLocalStorage` propagates its value through every `await` within the
 * same async call chain, any code that runs inside `fn` — no matter how deeply
 * nested — can call `getManager()` to obtain that same transactional manager,
 * without the manager being threaded as a parameter.
 *
 * ```
 * await this.transactionService.run(async () => {
 *   await this.projectMembershipRepository.createMembership(...)
 *   // ↑ internally calls getManager() → gets the transaction manager
 * })
 * ```
 *
 * ## Propagation: "join or start" (equivalent to Spring's REQUIRED)
 *
 * If `run()` is called while already inside another `run()`, it detects the
 * active transaction and simply executes `fn` within it — it does NOT open a
 * new (nested) database transaction. This means:
 *
 * - Outer caller rolls back everything on error, including work done by nested
 *   `run()` calls.
 * - Methods that call `run()` can be composed freely without worrying about
 *   inadvertent savepoints.
 *
 * ## Known limitations
 *
 * 1. **REQUIRES_NEW is not supported.** There is no built-in way to force a
 *    fresh, independent transaction from within an active one. If you need
 *    that, call `dataSource.transaction()` directly.
 *
 * 2. **Bull workers / long-running streams.** `AsyncLocalStorage` propagates
 *    across `await` boundaries in the same async chain. A Bull worker job runs
 *    in its own async context, so there is no cross-job leakage. However, if
 *    you spawn a job from inside a `run()` and then `await` its completion,
 *    the storage context does NOT propagate into the spawned job's async chain
 *    — the worker starts a fresh context. This is expected and safe: the job
 *    should manage its own transactions.
 *
 * 3. **Parallel async branches inside a single `run()`.** If you fire two
 *    independent promises in parallel (e.g. `Promise.all([a(), b()])`) inside
 *    a `run()`, both branches share the same transactional manager. This is
 *    fine for sequential reads, but writing from two parallel branches risks
 *    race conditions on the same underlying database connection. Prefer
 *    sequential writes inside a transaction.
 */
@Injectable()
export class TransactionService {
  private readonly storage = new AsyncLocalStorage<EntityManager>()

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Executes `fn` inside a database transaction.
   *
   * If already inside an active transaction (nested call), joins it instead of
   * opening a new one ("join or start" propagation).
   */
  run<T>(fn: () => Promise<T>): Promise<T> {
    const existingManager = this.storage.getStore()
    if (existingManager) {
      return fn()
    }
    return this.dataSource.transaction((manager) => this.storage.run(manager, fn))
  }

  /**
   * Returns the `EntityManager` for the current async context.
   *
   * - Inside a `run()` call: returns the transactional manager (all writes
   *   participate in the active transaction).
   * - Outside any `run()` call: returns the DataSource's default manager,
   *   which auto-commits each query — suitable for read-only operations or
   *   fire-and-forget writes that don't need transactional guarantees.
   */
  getManager(): EntityManager {
    return this.storage.getStore() ?? this.dataSource.manager
  }
}
