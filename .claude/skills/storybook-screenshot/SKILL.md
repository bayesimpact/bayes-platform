---
name: storybook-screenshot
description: Use when designing or changing a web screen or component and you want to see how it renders, when checking a UI change in French and English or at phone width, or when debugging a UI bug (blank page, missing data, clipped or overflowing layout, console error) without the real app or API running.
---

# Storybook screenshot

## Overview

Storybook renders every route and component of `apps/web` with seeded state and mocked services, without the API, a database or a login. The script opens one story in headless Chromium, saves a PNG to read with the Read tool, and lists console errors and warnings, uncaught exceptions, failed requests and content wider than the viewport.

## Steps

Run every command from the repository root. Pick a port and use it everywhere below as `PORT`: in the main checkout `6006` for `apps/web`, `6007` for `apps/web-embed`, `6008` for `packages/ui`; in a worktree another one (for example `6016`), since those may belong to another checkout's Storybook. In a fresh worktree, run `npm ci` first.

1. **Start Storybook** as a background command (Bash `run_in_background: true`):

   ```bash
   npm --prefix apps/web run storybook -- -p PORT --ci --no-open
   ```

   For shared components, use `--prefix packages/ui`; for the embed widget, `--prefix apps/web-embed`.

2. **Wait until it serves stories**, as a background command (a foreground `sleep` may be blocked), then **find the story id** with a word of the screen you want:

   ```bash
   until curl -sf http://localhost:PORT/index.json >/dev/null; do sleep 3; done
   curl -s http://localhost:PORT/index.json | grep -o '"id":"[^"]*SEARCH_WORD[^"]*"'
   ```

   An id is the story `title` in kebab case, `--`, then the export name: `title: "routes/studio/project/membership"` with `export const Default` gives `routes-studio-project-membership--default`. Open the story file (`apps/web/src/stories/...`) to see its exports and `argTypes`: the states you can reach come from both, for example a `WithData` export or a `withMemberAgents` toggle. Storybook silently ignores an arg the component does not use, so pass names you saw in the story's `argTypes` or `args`, or props of its component.

3. **Take the screenshot** into your scratchpad directory:

   ```bash
   node .claude/skills/storybook-screenshot/scripts/screenshot.mjs --port PORT \
     --story routes-studio-project-membership--default \
     --args "withMemberAgents:!true" \
     --lang fr,en --full-page --out <scratchpad>/shots
   ```

   On a phone: add `--width 390 --height 844`. `--lang` defaults to `fr`. The first run installs Playwright outside the repo. `--help` lists every option.

4. **Look at it**: open each PNG with the Read tool, and read the problems printed under each screenshot (exit code `2` means it found some). The script cannot spot copy problems: read the text in the French PNG for English left untranslated.

5. **Iterate**: Storybook hot-reloads on save, so edit the code and run step 3 again.

6. **Stop Storybook** when done:

   ```bash
   pkill -f "[s]torybook dev.*-p PORT"
   ```

   The npm script already passes its default port, so the pattern matches on the last `-p`. The background task then reports a failure (exit 143 or 144): that is the stopped Storybook, not an error.

## Storybook MCP server

`@storybook/addon-mcp` (enabled in `apps/web` and `packages/ui`) serves an MCP server at `http://localhost:PORT/mcp` while that Storybook runs. `.mcp.json` registers both for the project: `storybook-web` on port 6006 and `storybook-ui` on port 6008, the main checkout's ports. If their tools are not in your tool list, the user has not approved them yet or their Storybook was not running when the session started: ask the user to start it and reconnect from `/mcp`. A Storybook on another port (in a worktree) is not reachable through them, so use the script there.

When it is connected:

| Tool | Use it to |
|------|-----------|
| `stories-find-by-component` | Get the story ids that render the files you changed (`componentPaths`, relative to the package), instead of grepping `index.json` |
| `docs-list`, `docs-show` | Read the props and examples of a documented component before using it |
| `get-storybook-story-instructions` | Read the conventions before writing or editing a story |
| `stories-preview` | Get a link to a story for the user |

The MCP server returns links, not images: take the screenshot with the script. It has no `test-run` tool, which needs `@storybook/addon-vitest`.

## Quick reference

| Need | How |
|------|-----|
| Another state of the story | `--args "name:value;other:!true"`: booleans are `!true` / `!false`, spaces in a string are `+` |
| Several cases into one folder | `--name <case>` per run, or files overwrite each other |
| Check that a layout holds | Also pass long text and many items through `--args`: short sample labels hide overflow |
| Both languages | `--lang fr,en` (the app reads `i18nextLng` from localStorage) |
| Phone width | `--width 390 --height 844` |
| Whole page height | `--full-page` (it never widens the capture: horizontal overflow is reported as a problem instead) |
| Content that loads late | `--wait-for "text=Permissions"` or a larger `--wait` |
| A custom check (click, hover, measure, a contact sheet of several variants) | Copy `scripts/custom-check.example.mjs` to your scratchpad with the Write tool, edit the marked part, run `node <copy> PORT <story-id> <out-dir>` |

## Getting the state you need

A story shows only what its seeds and factories produce. If the case you need (an empty list, an owner, many items, a no-access row) cannot be reached through `argTypes`, add the toggle to the story or the default to the factory, following ADR 0010. Do not hard-code data in the component to get a picture.

Factories use random sample data, so names and counts change between runs. Compare before and after screenshots on layout, not on exact text.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| `pkill -f "storybook dev"` | It matches and kills your own shell. Keep the `[s]` and the port in the pattern. |
| Screenshot shows old or unrelated code | Another Storybook owns the port. Use a free port and pass the same one to `--port`. |
| Blank or "No Preview" screenshot | Wrong story id, or the story throws: read the problems printed by the script. |
| Judging a phone layout from the PNG alone | Clipped content does not show in the picture. Read the "horizontal overflow" line. |
| `Chromium is missing` | Run the `npx --prefix ... playwright install chromium` command the script prints. |
| Adding Playwright to a `package.json` | Never. The script installs it outside the repo. |
