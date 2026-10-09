# Worktree environments

Every git worktree can run its own dev environment, side by side with the others: the web app,
the API, the workers, web-embed, the help site, the pdf-converter, the three Storybooks, Grafana,
Bull Board, a Dex to sign in, a Phoenix project for its traces, and its own databases copied
from your local one. Each service gets a URL such as `http://fix-sidebar.connect.localhost:8800`,
and http://dev.connect.localhost:8800 lists every environment of the machine.

## Daily use

In Claude Code, `/worktree-env fix-sidebar` creates `.claude/worktrees/fix-sidebar`, moves the
session there and starts the environment (a few minutes the first time). In any worktree, Claude's
or not, `npm run wt -- up` does the same.

The name gives the URLs, and an issue number works too: `/worktree-env 135` shows the title of
issue 135 (from bayes-platform or internal-issues) and serves the app on
`http://135.connect.localhost:8800`. `/worktree-env` alone proposes a name.

| Command (`npm run wt -- ...`) | What it does |
|---|---|
| `up` | Creates or updates the environment of the current worktree, then prints its URLs. Safe to repeat, and needed after a change to `package-lock.json`. |
| `logs [service] [--follow]` | Logs of the environment or of one service. |
| `restart [service]`, `stop`, `start` | `stop` pauses the environment until `start`, reboots included. |
| `reset-db` | Replaces its databases with a fresh copy of the main checkout's. |
| `dex-sync` | Gives a Dex account to people added to its database since it started. |
| `down` | Removes its containers, volumes and databases. A dump stays in `~/.bayes-worktrees/trash/` for 14 days. |
| `status`, `doctor` | Every environment of the machine; checks of the machine. |

Sign in with your email and the local dev password. Commands you run on the host in the worktree
(tests, typecheck, `migration:run`, scripts) use the environment's databases and Redis, never the
main checkout's. Do not start `npm run dev` or a Storybook on the host of a worktree: the
environment runs them, and your edits reload there.

## Setup, once per machine

You need Docker (Docker Desktop on a Mac, with about 7 GB of memory per environment you run at
the same time), Node 22 or later, `gh` signed in (for the pull request shown on the dashboard), and
Chrome or Firefox: Safari does not resolve `*.localhost`. Windows is not supported yet.

1. In the main checkout: `node infra/dex/sync-users.mjs`. It sets the local dev password and moves
   the people of your local database to Dex (see [infra/dex/README.md](../dex/README.md)).
2. `npm run wt -- setup`. It creates the shared caches, starts the shared stack with the `router`,
   `traces` and `mail` profiles, and creates the read-only role of Grafana.
3. Document uploads go from the browser straight to the dev bucket, so its CORS must accept the
   environments' origins: the shared bucket of the dev VMs does (bayesimpact/infra), and for a
   bucket of your own, `gcloud storage buckets update gs://<bucket> --cors-file=cors.json`.
4. On the dev VM, forward port 8800 (the environments) and 5556 (the main checkout's Dex) to your
   laptop. VS Code does it with the settings of the repository; otherwise
   `ssh -L 8800:localhost:8800 -L 5556:localhost:5556 <vm>`. Raise the inotify limit, since every
   dev server takes one instance: `sudo sysctl fs.inotify.max_user_instances=1024`.
5. Open http://dev.connect.localhost:8800.

`npm run wt -- doctor` checks all of this.

## How it works

- **Containers.** `wt up` writes `infra/worktree/.env` (gitignored), then runs `docker compose up`
  with [docker-compose.yaml](docker-compose.yaml): one compose project, `wt-<name>`, per worktree.
  The worktree is mounted at its own path, so logs and stack traces show paths you can open. Each
  service keeps its default port inside its container. Containers restart with Docker after a
  reboot.
- **Routing.** One Traefik for the machine (the `router` profile of `infra/database`) serves every
  `*.connect.localhost` host on `127.0.0.1:8800`, from Docker labels. Plain HTTP is enough: browsers
  treat `*.localhost` as a secure context. On a given host, `/api` and `/public` go to the
  environment's API, so the web app calls its own origin and needs no CORS.
- **Databases.** The `db` step copies the main checkout's database (`connect`) into
  `connect_wt_<name>` with `pg_dump | pg_restore`, which works while the main API is connected
  (`CREATE DATABASE ... TEMPLATE` does not), and creates an empty `connect_wt_<name>__test`. The
  `migrate` step runs the branch's migrations on both at every `up`. `wt up` also rewrites
  `DATABASE_NAME`, `BULLMQ_REDIS_URL` and the test `DATABASE_URL` in the worktree's own `.env`
  files.
- **Dependencies.** `node_modules` live in volumes of the project. The `init` step runs `npm ci`
  in them only when `package-lock.json` changed, then builds `api-contracts` and the embed
  launcher. The worktree keeps its own `node_modules` on the host for the commands you run there.
- **Sign-in.** Each environment runs its own Dex at `http://<name>-dex.connect.localhost:8800/dex`,
  with the people of its database and the local dev password. The browser reaches it through
  Traefik, the API through a network alias, so both see the same issuer. At the first sign-in the
  API links your account by verified email, and every account keeps its data.
- **Traces and emails.** Traces go to the Phoenix project `wt-<name>`. Emails never leave the
  machine: they land in Mailpit (http://mail.connect.localhost:8800), since the copied database
  holds real addresses.
- **Shared state.** `~/.bayes-worktrees/` holds the local dev password hash, each environment's Dex
  configuration, `status.json` for the dashboard, locks and dumps.

## When something goes wrong

- **`wt up` stops on a failed step.** It prints the step's logs. Fix the cause (often a migration
  of the branch) and run `npm run wt -- up` again.
- **A URL shows "not answering yet".** The service is starting or restarting; the page reloads by
  itself. `npm run wt -- logs <service>` tells why when it lasts.
- **"No environment answers at ..."** Start it with `/worktree-env <name>`, or `npm run wt -- up` in
  that worktree.
- **Signed out after a restart.** Dex keeps its keys in memory: sign in again.
- **Someone invited in the environment cannot sign in.** `npm run wt -- dex-sync`.
- **Logging out of Bull Board fails.** Dex has no logout endpoint, while Bull Board asks the
  provider to log out. Close the tab instead.
- **Port 8800 is taken on the laptop.** VS Code reports it instead of picking another port, which
  would break every URL. Free it, or set `ROUTER_PORT` in `infra/database/.env` and run
  `npm run wt -- setup --recreate`.
- **A document deleted in an environment is gone in main too.** The environments share the dev
  bucket of Google Cloud Storage with the main checkout.
- **The machine runs out of memory.** An environment uses about 7 GB. `npm run wt -- stop` pauses
  the ones you do not use.
- **Never run `docker compose up` in a worktree's `infra/database`.** That copy of the shared
  stack would bind another data folder. Manage the shared stack from the main checkout, or through
  `npm run wt -- setup`.
