---
name: check-permission-matrix
description: Audit that docs/rbac-permission-matrix.md matches the RBAC catalog in code (roles, permissions, and grants in rbac.constants.ts and api-contracts permissions.ts). Reports every mismatch.
---

Verify that `docs/rbac-permission-matrix.md` is an exact mirror of the RBAC catalog in code.

## Steps

1. Read the two code sources of truth:
   - `packages/api-contracts/src/rbac/permissions.ts` — permission string constants (the only declaration) and every member of the `GlobalPermission` union.
   - `apps/api/src/domains/rbac/rbac.constants.ts` — extract every role key and its granted permissions from every `*_ROLE_PERMISSIONS` map: `ORGANIZATION_ROLE_PERMISSIONS`, `PROJECT_ROLE_PERMISSIONS`, `AGENT_ROLE_PERMISSIONS` and `REVIEW_CAMPAIGN_ROLE_PERMISSIONS`. Search the file for `_ROLE_PERMISSIONS = {` so a new map is not missed. Also read `PROJECT_PERMISSIONS_FROM_REVIEW_CAMPAIGN` (the project keys a campaign role gives on the campaign's project), `REVIEW_CAMPAIGN_STATUSES_GIVING_PROJECT_PERMISSIONS` (the campaign statuses under which each campaign role gives them), `RESOURCE_TYPE_PERMISSIONS_MAP` (the keys a parent passes down to each child type) and `PARENT_RESOURCE_TYPE_MAP` (the parents of each type). Permission constants such as `TRACE_READ_PERMISSION` are imported from the contracts file; resolve them to their string values. The API file must not redeclare those strings.

2. Read `docs/rbac-permission-matrix.md` and parse each table into (permission, role) → granted/not-granted pairs. A cell such as `✅ while active` is a grant with a campaign status condition.

3. Compare both directions and collect mismatches:
   - Role in code but missing from the doc (or the reverse)
   - Permission granted in code but unchecked/missing in the doc (or the reverse)
   - `GlobalPermission` union member absent from the "Global roles" table
   - A key granted on a review campaign role that is neither a `review_campaign.*` key nor in `PROJECT_PERMISSIONS_FROM_REVIEW_CAMPAIGN`
   - A campaign status statement in the doc, in prose or in a table cell, that differs from `REVIEW_CAMPAIGN_STATUSES_GIVING_PROJECT_PERMISSIONS`
   - A statement that a key passes down from a parent, or does not, that differs from `RESOURCE_TYPE_PERMISSIONS_MAP` and `PARENT_RESOURCE_TYPE_MAP`

4. Report the results:

### Mismatches
For each mismatch show the role, the permission, what the code says, and what the doc says.

### Summary
"N roles and M grants checked, X mismatches found." If everything matches, say the matrix is up to date. If there are mismatches, propose the exact doc edits to fix them.
