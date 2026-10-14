# Worktree environments

Each git worktree can run its own dev environment, side by side with the others: the web app, the
API, the workers, web-embed, the help site, the pdf-converter, the three Storybooks, Grafana, Bull
Board, a Dex to sign in, a Phoenix project for its traces, and its own databases copied from your
local one, on URLs such as `http://fix-sidebar.connect.localhost:8800`.

`npm run wt` runs the team's internal tooling (`bayes wt`), which creates, runs and removes these
environments, and serves their dashboard at http://dev.connect.localhost:8800. Its README covers
the setup, the commands and what to do when something breaks. In Claude Code,
`/worktree-env <name>` drives it.

This repository keeps what an environment is made of, since it changes with the code:

- [docker-compose.yaml](docker-compose.yaml): the services of an environment, one compose project
  `wt-<name>` per worktree, with the worktree mounted at its own path and `node_modules` in
  volumes. A pull request that adds a service or a workspace updates it in the same change.
- [init.sh](init.sh): installs the dependencies in those volumes when `package-lock.json` changed,
  then builds what the dev servers need.
- [db-init.sh](db-init.sh): copies the main checkout's database into `connect_wt_<name>` and
  creates an empty `connect_wt_<name>__test`.
- [`infra/database`](../database): the shared stack (Postgres, Redis, Traefik on port 8800,
  Phoenix, Mailpit), and [`infra/dex`](../dex): the Dex configuration of an environment.

The tooling fills the `WT_*` variables of the compose template in `infra/worktree/.env`
(gitignored), and finds the containers by their `dev.worktree.*` labels: keep both when you edit
the template. Commands you run on the host in a worktree (tests, typecheck, `migration:run`) use
the environment's databases and Redis, never the main checkout's.
