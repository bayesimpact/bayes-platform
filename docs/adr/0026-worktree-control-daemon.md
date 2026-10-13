# ADR 0026: Drive worktree environments from the dashboard and the menu bar

* **Status**: Accepted
* **Date**: 2026-10-12
* **Deciders**: Jérémie
* **Scope**: Local development: `infra/worktree/` (`wt serve`), `infra/dev-dashboard/`, `infra/wt-tray/`. Amends ADR 0025, whose dashboard was read-only.

---

## 1. Context and problem statement

ADR 0025 gave every worktree its own environment and a dashboard at
`http://dev.connect.localhost:8800` that lists them. The dashboard only shows commands to copy:
starting, stopping, creating or removing an environment still means a terminal in the right
folder. We want buttons for that, in the dashboard and in a menu bar app on the Mac.

Three facts shape the answer:

* **The commands run on the host, as the owner of the worktree.** `wt up`, `wt new` and
  `wt cleanup` need git, gh, Node, the worktree's files and `~/.bayes-worktrees`. A container
  cannot run them, and neither can another user.
* **The dev VM is shared.** Several people reach the same Traefik on `127.0.0.1:8800`, each
  through an SSH tunnel. The dashboard cannot tell who is looking at it, and everyone with
  Docker access is root in practice: no barrier between colleagues can sit above Docker. What we
  can prevent is a mistake on someone else's environment.
* **Untrusted code runs next to the dashboard.** The web apps and Storybooks of the worktrees run
  a branch's code and its npm packages, on `*.connect.localhost` (the same site as the dashboard)
  and in containers that reach the host. Any web page open in the browser can also send requests
  to `127.0.0.1`.

## 2. Decision

**Each user runs a small daemon, `npm run wt -- serve`, that runs the `wt` commands on their
environments. The dashboard forwards the requests of its buttons to the daemon of the caller,
who is known by a personal token. The menu bar app is one more client of the dashboard.**

* **A daemon per user.** `wt serve` (Node built-ins, like `wt.mjs`) listens on a Unix socket
  `/var/tmp/bayes-worktrees/<uid>.sock` on Linux. Docker Desktop cannot pass a host socket to a
  container, so on a Mac it listens on `127.0.0.1` on a free port instead, which containers reach
  as `host.docker.internal`. It writes how to reach it in `/var/tmp/bayes-worktrees/<uid>.json`,
  a folder writable by everyone and sticky, in `/var/tmp` because a reboot keeps it and the
  dashboard restarts with Docker before any `wt` command. The Claude Code session start hook
  starts the daemon when it does not run, and the menu bar app does on a Mac.
* **A token per user, which is also their identity.** The daemon keeps
  `~/.bayes-worktrees/api-token` (mode 0600), shaped `<uid>.<secret>`. `npm run wt -- login`
  prints a link to the dashboard with the token in its fragment. The page stores it in its own
  storage, which no other origin reads, and drops the fragment. The token travels only in an
  `X-Wt-Token` header, never in a cookie or a URL, so a cross-site request cannot carry it.
* **The dashboard is the gateway.** For `/api/*` other than the read-only state, its server
  checks the `Host`, requires the exact origin of the dashboard when the request has an `Origin`
  (a browser), reads the uid of the token, and forwards the request to that user's daemon after
  checking that the socket or its description belongs to that uid (or to root, as every host
  file looks under Docker Desktop), so nobody can stand in for a colleague's daemon. The custom header forces a CORS preflight, which the gateway never allows:
  pages of other origins, worktree apps included, cannot call it.
* **The daemon acts only on its user's environments.** It compares the secret in constant time,
  and only acts on an environment whose worktree folder belongs to its uid. Each command runs as
  `wt.mjs` would in a terminal: the worktree's own copy for `up`, `reset-db`, `down` and
  `describe`, the main checkout's for `new` and `cleanup`, and `docker compose` for starting,
  stopping, restarting and the logs. Long commands become jobs whose output the page streams, one
  at a time per environment. `down`, `reset-db` and `cleanup --apply` ask for a confirmation in
  the page. On a Mac, it also opens a worktree in the editor or Terminal.
* **Without a token, nothing changes.** The dashboard stays read-only and its buttons copy the
  command, as today. Its pages for hosts that do not answer stay in the container, so they work
  without any daemon.
* **The menu bar app is a client.** `infra/wt-tray` (Tauri) reads the state and sends the actions
  through `http://dev.connect.localhost:8800` with the token, from Rust, so it works the same on a
  Mac and on a laptop tunnelled to the VM. On a Mac it reads the token from its file and starts
  the daemon if needed; on a laptop the token is pasted once.

## 3. Consequences

* An environment has an owner, shown on the dashboard. Buttons act only on the caller's
  environments; a colleague's are read-only.
* Each user's daemon adds the description, issue, branch and pull request of their environments,
  which the dashboard read until now from the status file of whoever started the shared stack.
* A leaked token lets its holder run `wt` commands as its owner on their environments, not other
  commands. `npm run wt -- login --rotate` replaces it.
* On a Mac, every container can open a connection to the daemon's port: the token is what stops
  the worktrees' code.

## 4. Alternatives considered

* **One daemon for the machine.** It would need root to run git and files as each owner.
* **The menu bar app runs the commands and serves the dashboard.** Simpler on a Mac, but nothing
  runs on a VM without a desktop, and the dashboard would disappear there.
* **The dashboard container runs the commands.** It has neither the owner's identity nor their
  git, gh and Node.
* **A cookie for the session.** Worktree apps share the site `connect.localhost`, so `SameSite`
  would not stop them.
