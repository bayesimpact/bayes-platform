# ADR 0024: One dev environment per git worktree

* **Status**: Accepted
* **Date**: 2026-10-08
* **Deciders**: Alexis, Jérémie
* **Scope**: Local development: `infra/worktree/`, `infra/database/` (shared stack, `router` profile), `infra/dev-dashboard/`, `infra/dex/`, the `/worktree` skill, `CLAUDE.md`.

---

## 1. Context and problem statement

Several Claude Code sessions and agents work in parallel git worktrees. Until now every worktree
shared the main checkout's database, Redis, ports and URLs: `.worktreeinclude` copied the `.env`
files as they were, and `CLAUDE.md` forbade a second stack. Two branches could not run at once,
a branch's migrations landed in everyone's database, and workers of one checkout could take the
jobs of another. Developers want, for each worktree, what `npm run dev` and
`npm run dev:workers-main` give them in the main checkout, with its own data and URLs, until the
pull request is merged.

The tooling must run on the shared dev VM (reached from a laptop through SSH port forwarding) and
on MacBooks with Docker Desktop. Windows comes later.

## 2. Decision

**Each worktree runs its own compose project of dev containers, routed by one Traefik per
machine on `http://<worktree>.connect.localhost:8800`.**

* **Containers for every dev server.** `infra/worktree/docker-compose.yaml` runs the API, the
  workers, the web app, web-embed, the help site, the pdf-converter, the three Storybooks, Grafana,
  a Dex and a Redis (`bullmq`) per worktree, from `node:24.21.0-trixie-slim` like production. The
  worktree is bind-mounted at its own path; `node_modules` live in volumes of the project, so the
  same setup works on Linux and on a Mac, whose host binaries are darwin builds. Containers restart
  with Docker, so an environment lives until it is removed.
* **One router for the machine.** The `router` profile of the shared stack runs Traefik on
  `127.0.0.1:8800` and a dashboard at `http://dev.connect.localhost:8800`. Routes come from Docker
  labels. Plain HTTP: Chrome and Firefox resolve `*.localhost` and treat it as a secure context, so
  no certificate has to be trusted. Only one port crosses the SSH tunnel of the VM.
* **Same origin for the API.** `/api` and `/public` of `<worktree>.connect.localhost` go to that
  environment's API, so the web app keeps calling its own origin and CORS stays untouched.
* **Databases copied, never shared.** The `db` step copies `connect` into `connect_wt_<worktree>`
  with `pg_dump | pg_restore` (it works while the main API is connected, which `CREATE DATABASE
  ... TEMPLATE` does not) and creates an empty `connect_wt_<worktree>__test`. The branch's
  migrations run on both at every `up`. The worktree's own `.env` files point host commands at
  them.
* **A Dex per environment.** Local sign-in moves from Auth0 to Dex (see `infra/dex`). Dex only
  accepts exact redirect URIs, so each environment runs its own Dex that lists its own URLs, with
  the people of its database and a local dev password. Accounts are linked by verified email at
  the first sign-in (ADR 0021), so nothing is lost.
* **Separate Redis, traces and emails.** BullMQ reads neither a database index nor a prefix, so
  isolation needs a Redis per environment. Traces go to the Phoenix project `wt-<worktree>` (the
  collector now inserts its default project instead of overwriting it). Emails go to Mailpit.
* **The skill is the only trigger.** `/worktree <name>` creates the worktree and its environment;
  `npm run wt -- up` does it in any worktree. Agent worktrees (`agent-*`) never get one.

## 3. Consequences

* An environment costs 5 to 6 GB of memory and about 2 GB of disk. The VM runs several; a 16 GB
  Mac runs one or two. `npm run wt -- stop` pauses one.
* The shared Postgres accepts 500 connections and its services restart with Docker.
  `make db-tests` no longer recreates it outside CI.
* The dev bucket of Google Cloud Storage stays shared: deleting a document in an environment
  deletes the file for the main checkout too.
* The main checkout keeps `npm run dev` on the host, with the shared Dex on port 5556.
* Environments outlive the session that created them. `npm run wt -- cleanup`, run in the
  background by a session start hook, removes an environment, its databases, its worktree and its
  branch once the pull request is merged or closed, only when nothing would be lost: no
  uncommitted change, no commit outside the pull request, nobody working in it. It starts in
  report-only mode.

## 4. Alternatives considered

* **Host processes under a small supervisor, Traefik on host ports.** Lighter, but each worktree
  needs its own block of ports, the processes do not survive a reboot by themselves, and the macOS
  path differs. Rejected for containers, which also give health checks and labels for routing.
* **Keycloak.** It accepts wildcard redirect URIs and derives its issuer from the request, but it
  is heavier and the team prefers Dex, which the repository already runs.
* **One Phoenix per worktree.** About 600 MB each; a project per worktree in the shared Phoenix
  gives the same separation.
* **TLS with a local CA.** Needed only if a browser refused `http://*.localhost` as a secure
  context; Chrome 141 and Firefox 142 accept it.
