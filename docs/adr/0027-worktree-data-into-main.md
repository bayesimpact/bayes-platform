# ADR 0027: Bring a worktree's data into the main database

* **Status**: Accepted
* **Date**: 2026-10-14
* **Deciders**: Jérémie
* **Scope**: Local development: `infra/worktree/` (`wt promote`, `wt restore-main`), `infra/dev-dashboard/`.

---

## 1. Context and problem statement

Each worktree environment works on a copy of the main checkout's database (ADR 0025). What a
developer sets up there, an app connected to a project or an MCP server, stays in that copy and
goes with it at cleanup. Every new worktree copies the main database again, so the setup has to
be redone in each one.

We want to copy chosen data of a worktree into the main database, after seeing what it is, and
to undo it. The schema grows every week: a mechanism that needs a change for each new table would
fall behind.

## 2. Decision

**`npm run wt -- promote` compares the two databases row by row and offers the differences in
coherent groups, all derived from the schema. A selection is copied into the main database after
a restore point, which `npm run wt -- restore-main` puts back. The dashboard shows the groups and
lets the owner pick row by row.**

* **A diff by primary key.** Every table with a primary key is compared, join tables included.
  A row only in the worktree is new. A row in both that differs is changed when its `updated_at`
  is newer in the worktree, or a conflict when the main database's is newer; without
  `updated_at`, a hash of the row tells a difference. Rows only in the main database are left
  alone: nothing is ever deleted there. TypeORM's own tables are skipped, and tables whose ids
  come from a sequence are reported, since their ids would collide.
* **Groups from foreign keys.** A row and the new rows it references, transitively, form a
  group: an app installation with its manifest, service user, role, permissions and memberships.
  References to rows the main database already has do not join groups, or a user who signed in
  again would gather everything they created. Lone rows of a table (messages, activities) gather
  into one group. Labels come from the first of `name`, `title`, `label`, `email`, `slug`, `key`,
  else the readable part of the key.
* **Defaults from columns, then from use.** New rows start selected; changes, conflicts, and rows
  with `revoked_at`, `consumed_at` or a past `expires_at` start unselected. Tables of lone rows
  the user left out entirely start unselected next time (`~/.bayes-worktrees/promote.json`).
* **The selection carries what it needs.** Selecting a row selects the new rows it references;
  leaving one out leaves out the rows that reference it. The copy runs in one transaction of
  upserts, with foreign key checks off while it loads (`session_replication_role = replica`),
  which handles cycles. It refuses when the main database lacks migrations of the worktree: rows
  those migrations insert would come twice, and columns they add would be lost.
* **Restore points.** Each copy first dumps the main database into
  `~/.bayes-worktrees/restore-points`, kept 14 days. A restore dumps the current state too, loads
  the dump into a new database, then swaps the names, so the main API only reconnects.

## 3. Consequences

* A new table needs nothing: it shows up in the diff with its rows, grouped by its foreign keys.
* On a machine whose users share the main database, a copy lands for everyone, and a restore also
  undoes what others changed since its restore point.
* Secrets travel as stored (encrypted MCP configuration, hashed client secrets): they work in the
  main database because the worktree's `.env` is a copy of the main checkout's, with the same keys.
* Data held in a polymorphic reference (a `resource_id` without foreign key) does not join a
  group: its rows show alone, to be picked by hand.

## 4. Alternatives considered

* **A list of exportable entities with their dependencies.** Precise, but every new entity needs
  an entry, which is what we want to avoid.
* **Logical replication or an audit trail of the worktree's writes.** Exact about what happened,
  but heavy to set up for each environment, and still blind to what is worth keeping.
* **A three-way diff against the copy the worktree started from.** It would tell deletions from
  additions in main, but keeps a full dump per worktree for a case we do not need: nothing is
  deleted in main.
