# Worktrees in the menu bar

A macOS menu bar app, built with Tauri, for the worktree environments
([infra/worktree/README.md](../worktree/README.md)), on this Mac or on the dev VM.

- The icon shows how many environments run, with a `!` when one has a problem.
- A click opens the list, yours first: branch, pull request and links of each, a button to start
  or stop it, Update (`wt up`, whose output opens in the dashboard), Editor and Terminal, and a
  button per service to start, stop, restart, or run `init`, `db` and `migrate` again. A
  colleague's environments are read-only.
- A right click opens the dashboard or quits.

It is a client of the dashboard's API at `http://dev.connect.localhost:8800`, which forwards its
buttons to your daemon (`npm run wt -- serve`), as for the dashboard's own buttons. See
[ADR 0026](../../docs/adr/0026-worktree-control-daemon.md).

- **On this Mac**, it reads your token from `~/.bayes-worktrees/api-token` and starts your daemon
  when it stopped, once it ran here once.
- **On a laptop tunnelled to the dev VM**, run `npm run wt -- login` on the VM and paste the token
  it prints in the app.

## Run it

You need Rust (`rustup`). From `infra/wt-tray`:

```bash
npm run dev
```

`npm run build` makes `src-tauri/target/release/bundle/macos/Worktrees.app`, to copy into
`/Applications` and add to the login items. The app is not signed: the first time, open it with
a right click, then Open.

`ROUTER_PORT` changes the router port (8800).
