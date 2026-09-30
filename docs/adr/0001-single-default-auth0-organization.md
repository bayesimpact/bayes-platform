# ADR 0001: Use of a Single Default Auth0 Organization

**Status:** Superseded by [ADR 0021](0021-generic-oidc-and-access-by-email.md)

**Date:** February 11, 2026

## 1. Context

The application needs to manage users but does not yet require strict isolation between different clients (complex multi-tenancy). However, we want to leverage Auth0's native capabilities so we don't have to migrate the architecture later.

## 2. Decision

We decided to configure Auth0 with a single default organization for all users.

- **Configuration:** All users are created and assigned to a single organization (e.g., `org_prod_default`).
- **Access:** Authentication is performed via the `organization` flag in the SDK configuration to enforce this context.
- **Integration:** The Auth0 organization ID (`org_id`) is stored as an environment variable (e.g., `AUTH0_ORGANIZATION_ID`) and used by the backend whenever it needs to interact with the Auth0 Management API — for example, when sending user invitations or managing organization members.

## 3. Rationale

- **Simplicity:** Avoids having to manage organization selection logic or complex filtering in the code for now.
- **Standardization:** Using Auth0's Organization object from the start allows us to benefit from organization-specific email templates and branding without additional effort.

## 4. Scalability (The "Link")

Although all users are in the same organization today, this structure enables:

- **Future multi-org:** If a user ever needs to join a second organization (e.g., an external expert working on another instance), we will use Auth0's Account Linking.
- **Smooth transition:** Moving from a "Mono-Org" model to a "Multi-Org" model will not require a database overhaul, since the `org_id` field will already be present and used in our tokens.

## 5. Consequences

- **Positive:** Clean architecture from day one, ready for B2B or multi-tenancy.
- **Negative:** Adds a slight layer of initial configuration in the Auth0 dashboard (creating the organization and assigning users).
