# ADR 0012: Form Architecture — react-hook-form + Zod + the shared `Form` components

* **Status**: Accepted
* **Date**: 2026-06-18
* **Deciders**: Alexis
* **Scope**: Every form under `apps/web/src/` — anything that collects user input and submits it (create/edit dialogs, full-page editors, settings panels, inline single-field forms). Read this before writing or touching a form.

> **Companion ADRs**: [ADR 0011](0011-frontend-architecture.md) (frontend architecture — features, store, thunks). Forms live inside feature `components/` and submit through the Redux thunks that ADR describes. The rules here assume you've read it.

---

## 1. Why this ADR exists

Forms drifted into three incompatible styles: hand-rolled `useState` per field with manual validation, `useForm` + ad-hoc `<p className="text-destructive">` error lines, and the shared `Form` components. The consequences were always the same:

1. **Validation diverged from the API.** A field's client check (max length, required, enum) was retyped by hand and fell out of sync with the Zod schema the API enforces, so the form either rejected valid input or POSTed payloads the server 400s.
2. **Errors never surfaced.** Manual forms disabled the submit button instead of explaining *why*; server validation errors were swallowed into a generic toast.
3. **Inconsistent a11y and markup.** Each form wired `id`/`htmlFor`/`aria-invalid`/`aria-describedby` differently (or not at all).

The fix is one mandated stack: **`react-hook-form` for state, Zod (the shared `api-contracts` schema) for validation via `zodResolver`, and the `@caseai-connect/ui/shad/form` components for markup.** [ResourceForm.tsx](../../apps/web/src/studio/features/resource-libraries/components/ResourceForm.tsx) is the canonical reference; copy it.

---

## 2. The mandated stack

| Concern | Use | Never |
|---|---|---|
| Form state | `useForm<FormValues>()` from `react-hook-form` | `useState` per field |
| Validation | `zodResolver(schema)`, schema from `@caseai-connect/api-contracts` | hand-written `if (!value)` checks |
| Markup | `Form` / `FormField` / `FormItem` / `FormLabel` / `FormControl` / `FormDescription` / `FormMessage` from [@caseai-connect/ui/shad/form](../../packages/ui/src/shad/form.tsx) | bare `<Field>`/`<label>` + ad-hoc error `<p>` |
| Submit | `form.handleSubmit(onValid)` | `onClick` + manual validity gate |

The shared `Form` components are wrappers around react-hook-form's `Controller` + context. They wire `id`, `htmlFor`, `aria-invalid`, `aria-describedby`, and render the field's error message automatically through `FormMessage`. You get accessible, consistent forms for free — that is the entire point of using them over raw `<Field>`.

---

## 3. Rules

### 3.1 The resolver schema comes from `api-contracts`

The client MUST validate with the same Zod schema the API validates with. Import `create{Entity}Schema` / `update{Entity}Schema` (or the field object) from `@caseai-connect/api-contracts` and pass it to `zodResolver`. This is what keeps client and server in lockstep — a field's max length, required-ness, and enum live in exactly one place.

```ts
import { createResourceSchema } from "@caseai-connect/api-contracts"
import { zodResolver } from "@hookform/resolvers/zod"

type FormValues = z.infer<typeof createResourceSchema>

const form = useForm<FormValues>({
  resolver: zodResolver(createResourceSchema),
  defaultValues: { /* every field */ },
})
```

**Do NOT** redeclare the field shape inline (`z.object({ title: z.string().max(200) … })`) when a contract schema exists — that reintroduces the drift this ADR exists to kill.

### 3.2 UI-only rules extend the contract schema with `.refine`, they don't replace it

When the form needs a constraint the API doesn't encode (a stricter UX rule, a cross-field invariant), compose it onto the contract schema with `.refine` / `.superRefine` inside the component (so the message can be translated via `t`). Attach the issue to the relevant field with `path`.

```ts
const resourceSchema = useMemo(
  () =>
    createResourceSchema
      .refine((r) => r.description.trim().length > 0, {
        path: ["description"],
        message: t("resourceLibrary:resourceForm.required"),
      })
      .refine((r) => r.linkType !== "url" || isValidHttpsUrl((r.url ?? "").trim()), {
        path: ["url"],
        message: t("resourceLibrary:link.urlInvalid"),
      }),
  [t],
)
```

Memoise on `[t]` so the schema is stable across renders.

### 3.3 Every field is a `FormField` with `FormControl` + `FormMessage`

```tsx
<Form {...form}>
  <form onSubmit={form.handleSubmit(handleFormSubmit)}>
    <FormField
      control={form.control}
      name="title"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("…titleLabel")}</FormLabel>
          <FormControl>
            <Input placeholder={t("…titlePlaceholder")} {...field} />
          </FormControl>
          <FormDescription>{/* hint / character counter */}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>
```

- `FormMessage` (no children) renders the field's resolver error automatically. Do NOT hand-render `{errors.x && <p className="text-destructive">…</p>}`.
- `FormDescription` is the place for input characteristics — character counters (`{{count}}/{{max}}`), format hints, "not shown to users" notes. Surface the limits from the contract (e.g. an exported `*_FIELD_LIMITS` constant) rather than hard-coding numbers.
- Spread `{...field}` onto the input. For optional string fields whose value can be `undefined`, pin a controlled value: `<Textarea {...field} value={field.value ?? ""} />`.

### 3.4 Composite inputs are wired with `Controller` or `watch`/`setValue`

A `FormField` binds one `name`. When a sub-component edits several fields at once (a link picker that owns `linkType` + `url` + `file`, a rich editor, a multi-select), bind it through `Controller`, or drive it with `watch()` + `setValue(name, value, { shouldDirty: true, shouldValidate: true })` and render the combined error from `form.formState.errors`. See `ResourceLinkField` wiring in [ResourceForm.tsx](../../apps/web/src/studio/features/resource-libraries/components/ResourceForm.tsx). The sub-component stays presentational — it must NOT run its own validation or render its own error text; validation belongs to the resolver.

### 3.5 Submit goes through `handleSubmit`; don't gate the button on a hand-rolled validity check

`onSubmit={form.handleSubmit(onValid)}` runs validation and only calls `onValid` when the form is valid; otherwise it populates `formState.errors` and `FormMessage` shows them. Keep the submit button enabled (disable only on `formState.isSubmitting`, or additionally `!formState.isDirty` for edit-only forms to block no-op saves). Do NOT disable the button on a manual `isComplete(values)` predicate — that hides *why* the form can't submit, which is the regression this ADR reverses.

### 3.6 Create vs update stay separate (carried over)

A shared presentational `{Domain}Form` owns `useForm` + the fields and exposes an `onSubmit(fields)` prop. `Create{Domain}Form` and `Update{Domain}Form` are thin wrappers that dispatch the create/update thunk — a single form MUST NOT branch on create-vs-update with `if/else`. The shared form calls `onSubmit` with the validated, normalized payload; the wrapper hands it to the thunk.

```tsx
// shared form: owns useForm + fields, calls onSubmit(fields)
export function ResourceForm({ onSubmit, … }: { onSubmit: (fields: ResourceFields) => unknown; … }) { … }

// create wrapper
<ResourceForm onSubmit={(fields) => dispatch(addResource({ resourceLibraryId, fields, onSuccess }))} … />

// update wrapper
<ResourceForm onSubmit={(fields) => dispatch(updateResource({ resourceLibraryId, resourceId, fields, onSuccess }))} … />
```

### 3.7 Server errors still surface

Client validation prevents the *known* 400s; it does not replace handling the server's response. Mutation thunks reject with the API's message and the feature middleware shows it (see ADR 0011 §5.6 and the `getApiErrorMessage` helper). A form being valid client-side never means the toast on failure can be generic.

---

## 4. Anti-patterns (do not do these)

- **`useState` per field with a hand-written submit guard.** Use `useForm`.
- **An inline `z.object({...})` that duplicates a contract schema.** Import the contract schema; `.refine` for the extras.
- **`{...register("x")}` on a bare `<Field>` + `{errors.x && <p className="text-destructive">…</p>}`.** Use `FormField` + `FormControl` + `FormMessage`; they render the error and wire a11y for you.
- **A presentational sub-input that runs its own validation / shows its own red error.** Validation is the resolver's job; the field renders through `FormMessage`.
- **`disabled={!isComplete(values)}` on the submit button.** Validate on submit via `handleSubmit`; let `FormMessage` explain failures.
- **A single form `if (isEdit) … else …`.** Split into `Create*`/`Update*` wrappers around a shared form (§3.6).

---

## 5. Consequences

- **Positive**: one form shape across the app; client validation can't drift from the API because both read the same Zod schema; accessible markup and error rendering come for free from the `Form` components; server errors always have a path to the user.
- **Negative**: composite inputs need explicit `Controller`/`watch`+`setValue` wiring instead of a plain `onChange`. Worth it for the consistency and the a11y.
- **Migration**: `ResourceForm`, `ProjectGeneralForm`, and the agent forms follow this. Forms still using `useState`-per-field or ad-hoc error `<p>` (e.g. older tabs that `register` onto bare `<Field>`) are legacy and should be migrated to `FormField`/`FormMessage` when next touched; new forms MUST comply.
