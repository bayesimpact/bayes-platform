---
name: worktree-env
description: Create a git worktree with its own dev environment (web app, API, workers, Storybooks, Grafana, Bull Board, Dex, a Phoenix project and databases copied from the local one) on http://<name>.connect.localhost:8800, the name being a short name or an issue number, or manage the environment of the current worktree (status, logs, restart, stop, start, reset-db, down, its description on the dashboard). Use when the user asks to start work in a new worktree, to work on an issue in its own environment, to see a branch running, or about the environment of a worktree.
argument-hint: "[<name> | <issue number>] | status | logs [service] | restart [service] | stop | start | reset-db | dex-sync | down | describe <text>"
---

# Worktree environments

Each worktree gets its own containers, databases and URLs, so several branches run side by side.
`npm run wt` runs the team's internal tooling (`bayes wt`): `npm run wt -- help` lists its
commands, and its README says how it works and what to do when something breaks. If `bayes` is
missing, tell the user to install the team's internal tools. This repository keeps what the
environment is made of: `infra/worktree/README.md`.

## Create a worktree and its environment

1. Settle the name, which gives the URLs: `http://<name>.connect.localhost:8800`.
   - **An issue number** (`135`, `#135` or the issue's URL): the name is the number, so
     `http://135.connect.localhost:8800`. Find the issue with
     `gh issue view <number> --repo <repo> --json title,state,url`, in the repository of the URL
     when there is one, otherwise in `bayesimpact/bayes-platform`. Show the user its title and
     repository. When gh finds none there, ask the user which repository it belongs to. A number
     gh cannot find is still a valid name.
   - **A name**: lowercase letters, digits and single hyphens, at most 32 characters, not starting
     with `agent-`, not ending with `-ui`, `-embed`, `-help`, `-storybook`, `-dex` or `-grafana`,
     and none of `api`, `connect`, `dashboard`, `dev`, `grafana`, `mail`, `main`, `phoenix`,
     `router`, `traefik` and `www`. Suggest a valid name otherwise.
   - **Nothing**: propose a short name for the task at hand, or the issue's number when the
     conversation names an issue. Show it with the URL it gives, and ask the user to keep it or to
     give another name or an issue number.
2. Enter the worktree: if `.claude/worktrees/<name>` exists, call `EnterWorktree` with its
   `path`; otherwise call `EnterWorktree` with the `name`.
3. In the worktree, run `npm run wt -- up` with a 600000 ms timeout. For a new worktree, add what
   its card on the dashboard shows, so nobody has to guess later what it was for:
   - `--issue <URL>` with the URL of the issue found in step 1;
   - `--description "<text>"` when the name is not an issue number: one short sentence on the task,
     from the user's request (the card shows the issue's title otherwise).

   The first run takes a few minutes: it installs dependencies on the host and in the containers,
   copies the database and starts every server.
4. Show the user the URL list that `wt up` prints, as it is, under the issue's title when the name
   is an issue number.

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
- `describe "<text>" [--issue <number or URL>]`: changes what the dashboard card says the worktree
  is for, or the issue it links. Also reads its pull request again.
- `dex-sync`: gives a Dex account to people added to the environment's database (an invitation
  accepted in the worktree, for example).
- `down`: removes the containers, volumes and databases (a dump is kept 14 days). Ask the user
  before running it.
- `cleanup`: lists the environments and worktrees whose pull request is merged or closed and that
  are safe to remove. `cleanup --apply` removes them: ask the user first. A worktree kept as
  "in use by ..." has a session or a shell in it, maybe this one.
- `promote`: lists, in groups, what the environment's database has that the main checkout's lacks
  (an app connected in the worktree, an MCP server...). `promote --apply --all` or
  `--apply --groups 1,3` copies it into the main database, after a restore point: ask the user
  first, and suggest it before a cleanup when they set something up in the worktree. If it says
  migrations are missing, run `npm run migration:run -w apps/api` in the main checkout first.
- `restore-main [<id>]`: lists the restore points of the main database, or puts it back as it was
  at one: ask the user first.
- `login`: prints the link that enables the dashboard's buttons in the user's browser (start,
  stop, update, logs, new worktree...), through their daemon (`npm run wt -- serve`, started by
  the session start hook). Give the user the command rather than its output: the link holds their
  token.

## Working in a worktree that has an environment

- Never start `npm run dev`, `npm run dev:workers-main` or a Storybook on the host: the
  environment already runs them, and edits reload there.
- Commands you run on the host in the worktree (tests, typecheck, `migration:run`, scripts) use the
  environment's databases (`connect_wt_<name>` and `connect_wt_<name>__test`) and Redis. The main
  checkout's data is never touched.
- After a change to `package-lock.json`, run `npm run wt -- up`.
- The web app is at `http://<name>.connect.localhost:8800`. Sign in with your email and the local
  dev password.
