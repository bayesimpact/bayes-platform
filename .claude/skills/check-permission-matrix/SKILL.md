---
name: check-permission-matrix
description: Audit that docs/rbac-permission-matrix.md matches the RBAC catalog in code (roles, permissions, and grants in rbac.constants.ts and api-contracts permissions.ts). Reports every mismatch.
---

Verify that `docs/rbac-permission-matrix.md` is an exact mirror of the RBAC catalog in code.

## Steps

1. Read the two code sources of truth:
   - `packages/api-contracts/src/rbac/permissions.ts` — permission string constants (the only declaration) and every member of the `GlobalPermission` union.
   - `apps/api/src/domains/rbac/rbac.constants.ts` — extract every role key and its granted permissions from `ORGANIZATION_ROLE_PERMISSIONS`, `PROJECT_ROLE_PERMISSIONS`, and `AGENT_ROLE_PERMISSIONS`. Permission constants such as `TRACE_READ_PERMISSION` are imported from the contracts file; resolve them to their string values. The API file must not redeclare those strings.

2. Read `docs/rbac-permission-matrix.md` and parse each table into (permission, role) → granted/not-granted pairs.

3. Compare both directions and collect mismatches:
   - Role in code but missing from the doc (or the reverse)
   - Permission granted in code but unchecked/missing in the doc (or the reverse)
   - `GlobalPermission` union member absent from the "Global roles" table

4. Report the results:

### Mismatches
For each mismatch show the role, the permission, what the code says, and what the doc says.

### Summary
"N roles and M grants checked, X mismatches found." If everything matches, say the matrix is up to date. If there are mismatches, propose the exact doc edits to fix them.
