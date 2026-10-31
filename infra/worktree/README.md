# Worktree environments

Each git worktree can run its own dev environment, side by side with the others: the web app, the
Desk, the API, the workers, web-embed, the help site, the pdf-converter, the four Storybooks, Grafana, Bull
Board, a sign-in page (oidc-picker), a Phoenix project for its traces, and its own databases copied
from your local one, on URLs such as `http://fix-sidebar.connect.localhost:8800`.

Only its core runs by default: the API, the web app, the sign-in, Redis and the contracts' watcher.
The workers, the pdf-converter, the Desk, web-embed, the help site, the Storybooks, Grafana and
Bull Board each have a compose profile of their name, which the team's tooling turns on per
environment.

The Desk (`apps/desk`, profile `desk`) answers on the environment's own host under `/app/`, like
the API under `/api`: its Traefik router sits between theirs, so the three share one origin as in
production. While it runs, the `/app` pages of the web app are out of reach in that environment.

The team's tooling creates, runs and removes these environments, and serves their dashboard at
http://dev.connect.localhost:8800.

This repository keeps what an environment is made of, since it changes with the code:

- [docker-compose.yaml](docker-compose.yaml): the services of an environment, one compose project
  `wt-<name>` per worktree, with the worktree mounted at its own path and `node_modules` in
  volumes. A pull request that adds a service or a workspace updates it in the same change.
- [init.sh](init.sh): installs the dependencies in those volumes when `package-lock.json` changed,
  then builds what the dev servers need.
- [db-init.sh](db-init.sh): copies the main checkout's database into `connect_wt_<name>` and
  creates an empty `connect_wt_<name>__test` (see [The test database](#the-test-database)).
- [`infra/database`](../database): the shared stack (Postgres, Redis, Traefik, Phoenix,
  Mailpit), and [`infra/oidc-picker`](../oidc-picker): the sign-in configuration of an environment.

The tooling fills the `WT_*` variables of the compose template in `infra/worktree/.env`
(gitignored), and finds the containers by their `dev.worktree.*` labels: keep both when you edit
the template. The names of an environment come from `WT_SCHEME`, `WT_DOMAIN` and
`WT_PORT_SUFFIX` (`http`, `connect.localhost` and `:8800` by default), and its Storybooks listen
on `WT_PUBLIC_PORT`, the port of those URLs.

## HTTPS on a domain of your own

By default, environments answer on `http://<name>.connect.localhost:8800`: browsers resolve
`*.localhost` by themselves and treat it as a secure context. To serve them in https instead,
with a real certificate, use a domain of yours whose names all resolve to your machine:

1. **A domain that resolves to 127.0.0.1.** In a DNS zone you control, add a wildcard such as
   `*.connect.example.org` with an `A` record `127.0.0.1` and an `AAAA` record `::1`. It is
   public, and it only ever points to the machine that resolves it.
2. **A wildcard certificate for it.** Request `*.connect.example.org` with the DNS-01 challenge,
   since nothing on the internet can reach 127.0.0.1, for example with certbot and the plugin of
   your DNS provider:
   `certbot certonly --dns-<provider> -d '*.connect.example.org'`. One wildcard serves every
   environment, so no certificate ever names a worktree in the public certificate logs. For a
   machine of your own, a locally trusted certificate works too:
   `mkcert '*.connect.example.org'`.
3. **The files.** Put them in `infra/database/dev-certs/` (gitignored), or in a folder of your
   choice named by `DEV_CERT_DIR`, as `connect.crt` (the full chain, PEM) and `connect.key` (the
   private key, PEM, mode 600), next to a `traefik.yml` that names them for Traefik:

   ```yaml
   tls:
     stores:
       default:
         defaultCertificate:
           certFile: /certs/connect.crt
           keyFile: /certs/connect.key
   ```

   Traefik watches that folder: a renewed certificate is served as soon as its files change, with
   no restart. Never commit them.
4. **The options**, in `infra/database/.env`: `DEV_DOMAIN=connect.example.org`, and
   `HTTPS_PORT=443` for URLs without a port (the default, 8443, needs no privilege). Then recreate
   Traefik from the main checkout (`docker compose --profile router up -d traefik` in
   `infra/database`), and set up the environments again with your worktree tooling, which writes
   the https names (`WT_SCHEME=https`, `WT_DOMAIN`, `WT_PORT_SUFFIX`) into their `.env`.

Plain http to `DEV_DOMAIN` redirects to https, and the `connect.localhost` names keep answering.
On a remote machine reached through an SSH tunnel, use a port above 1024 for `HTTPS_PORT` and
forward that same port: forwarding 443 needs root on most laptops.

Some internet boxes and DNS resolvers drop public answers that point to 127.0.0.1, a protection
against DNS rebinding: the names then do not resolve at all, while `dig @8.8.8.8` resolves them.
Name the hosts you use in `/etc/hosts` (`127.0.0.1 <name>.connect.example.org` and its
`<name>-<service>` hosts: it takes no wildcard), or use a resolver that keeps such answers.

## The test database

Commands you run on the host in a worktree (tests, typecheck, `migration:run`) use the
environment's databases and Redis, never the main checkout's. The API's tests use
`connect_wt_<name>__test`, which holds no data worth keeping.

At every `up`, the `migrate` service runs the branch's migrations on it, after the copy. The
tests then build the tables of newer entities with TypeORM's `synchronize`, which records no
migration. Once the branch brings a migration that this database has not run, for example after a
merge of main, replaying it would fail on a table that `synchronize` already made, and the API
would never start. So `db-init.sh` drops the test database when its `migrations` table lacks one
of the branch's migration files, and `migrate` builds it again from the first migration, in a few
seconds. Tests that run on the host at that moment lose their connection.
