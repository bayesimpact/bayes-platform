---
name: worktree
description: Create a git worktree with its own dev environment (web app, API, workers, Storybooks, Grafana, Bull Board, Dex, a Phoenix project and databases copied from the local one) on http://<name>.connect.localhost:8800, or manage the environment of the current worktree (status, logs, restart, stop, start, reset-db, down). Use when the user asks to start work in a new worktree, to see a branch running, or about the environment of a worktree.
argument-hint: "<name> | status | logs [service] | restart [service] | stop | start | reset-db | dex-sync | down"
---

# Worktree environments

Each worktree gets its own containers, databases and URLs, so several branches run side by side.
How it works and what to do when something breaks: `infra/worktree/README.md`.

## With a name: create the worktree and its environment

1. Check the name: lowercase letters, digits and single hyphens, starting with a letter, at most
   32 characters, not ending with `-ui`, `-embed`, `-help`, `-storybook`, `-dex` or `-grafana`,
   and not `dev`, `traefik`, `phoenix`, `mail` or `grafana`. Suggest a valid name otherwise.
2. Enter the worktree: if `.claude/worktrees/<name>` exists, call `EnterWorktree` with its
   `path`; otherwise call `EnterWorktree` with the `name`.
3. In the worktree, run `npm run wt -- up` with a 600000 ms timeout. The first run takes a few
   minutes: it installs dependencies on the host and in the containers, copies the database and
   starts every server.
4. Show the user the URL list that `wt up` prints, as it is.

If `wt up` reports a failure, read the logs it printed, fix what you can (for example a migration
of the branch), then run `npm run wt -- up` again: it is safe to repeat.

## With a command: manage the current worktree's environment

Run `npm run wt -- <command>` in the worktree and report the result:

- `status`: every environment of this machine.
- `logs [service] [--follow]`: services are `api`, `workers`, `web`, `embed`, `help`,
  `storybook-web`, `storybook-ui`, `storybook-embed`, `grafana`, `dex`, `bullmq`,
  `pdf-converter`, `contracts`, `init`, `db`, `migrate`. Never use `--follow` yourself: it does
  not end.
- `restart [service]`, `stop`, `start`.
- `reset-db`: replaces the environment's databases with a fresh copy of the main checkout's.
- `dex-sync`: gives a Dex account to people added to the environment's database (an invitation
  accepted in the worktree, for example).
- `down`: removes the containers, volumes and databases (a dump is kept 14 days). Ask the user
  before running it.

## Working in a worktree that has an environment

- Never start `npm run dev`, `npm run dev:workers-main` or a Storybook on the host: the
  environment already runs them, and edits reload there.
- Commands you run on the host in the worktree (tests, typecheck, `migration:run`, scripts) use the
  environment's databases (`connect_wt_<name>` and `connect_wt_<name>__test`) and Redis. The main
  checkout's data is never touched.
- After a change to `package-lock.json`, run `npm run wt -- up`.
- The web app is at `http://<name>.connect.localhost:8800`. Sign in with your email and the local
  dev password.
