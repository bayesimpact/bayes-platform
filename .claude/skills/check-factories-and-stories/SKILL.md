---
name: check-factories-and-stories
description: Audit apps/web for the two paired rules from ADR 0010 — every `*.models.ts` has a sibling `*.factory.ts`, and every route registered in `{Scope}Routes.tsx` has a matching `stories/routes/{scope}/{Route}.stories.tsx`. Reports missing factories and missing route stories.
---

Audit `apps/web/src` for two invariants from [ADR 0010](../../../docs/adr/0010-factory-per-model-and-story-per-route.md):

1. Every `*.models.ts` MUST have a sibling `*.factory.ts` (in the same folder; name may be singular or plural — match the folder convention).
2. Every named route used in a `{Scope}Routes.tsx` registry MUST have a matching story file under `apps/web/src/stories/routes/{scope}/{RouteName}.stories.tsx`.

This is read-only. Do not write or edit files — just report.

---

## Step 1 — Find every model file

Use Glob (or `find`) to list:
```
apps/web/src/**/*.models.ts
```

For each match, derive the expected factory path by replacing `.models.ts` with `.factory.ts` in the SAME folder. Singular variants are also acceptable — strip the trailing `s` from the basename before `.models.ts` (e.g. `agents.models.ts` accepts `agent.factory.ts` OR `agents.factory.ts`). A factory is "present" if EITHER form exists in the model's folder.

Exclusions:
- Any model file under a `__tests__/` or `__mocks__/` directory.
- `notifications.models.ts` and other purely UI-state slices that don't represent domain entities — only flag if the file declares a `type X = XDto` or a Zod schema (heuristic: contains `import type` from `@caseai-connect/api-contracts` OR `z.object(`). If neither pattern is present, treat the file as exempt.

Read the contents of each candidate to apply the exclusion heuristic.

## Step 2 — Find every route registered in a routes registry

Use Glob to list `apps/web/src/*/routes/*.tsx` (excluding `apps/web/src/stories/`). For each registry file, read it and extract the names of every route used as the `path:` value or `element:` wrapper component name that lives in the same `routes/` folder (e.g. `EvaluationRoute`, `DocumentsRoute`, `TesterCampaignRoute`).

For each route component name, derive the expected story path:
```
apps/web/src/stories/routes/{scope}/{ComponentName}.stories.tsx
```
where `{scope}` is the parent folder of the routes file (`studio`, `tester`, `reviewer`, `eval`, `backoffice`, `desk`).

A route is "present" if the story file exists. Exclusions:
- Routes named `*RouteHandler`, `*Handler`, or that are pure redirects (read the route file; if the component just returns `<Navigate to=... />` or `<Outlet />` without data, mark exempt).
- Common shells (`StudioRoute`, `TesterRoute`, etc.) — these are root wrappers, not leaf routes. Skip any file whose name matches the scope itself (`{Scope}Route.tsx`).

## Step 3 — Report

Output exactly three sections. Use markdown links (`[file](relative/path)`) so paths are clickable in the IDE.

### Missing factories
List every model whose sibling factory is absent. For each:
- `[path/to/foo.models.ts](apps/web/src/.../foo.models.ts)` — expected `foo.factory.ts` (or `foo-singular.factory.ts`)

### Missing route stories
List every route component without a story. For each:
- `[FooRoute](apps/web/src/{scope}/routes/FooRoute.tsx)` — expected `apps/web/src/stories/routes/{scope}/FooRoute.stories.tsx`

### Summary
- `N models checked, M missing factories.`
- `K routes checked, L missing stories.`
- If both counts are zero: congratulate the user.

Do not propose fixes inline — just list the gaps. The user runs the skill to get a worklist, not auto-edits.
