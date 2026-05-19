# Feature Specification: Auth0 Invitation Sending for Project Memberships

## Overview

When a user is invited to a project (via the existing `inviteProjectMembers` flow), we need to send them an invitation email through **Auth0's Organizations Invitations API**. This ensures that:

- New users get a proper sign-up flow via Auth0.
- Existing Auth0 users get a direct link to accept the invitation.
- Our `invitationToken` is passed as metadata so we can reconcile the Auth0 invitation with the `ProjectMembership` record upon acceptance.

---

## Context & Decisions

### Single Auth0 Organization (ADR-0001)

Per [ADR-0001](../ADR/0001-single-default-auth0-organization.md), all users belong to a single Auth0 organization. The Auth0 organization ID is stored in the `AUTH0_ORGANIZATION_ID` environment variable. Every invitation is sent under this organization.

### Service Abstraction (Mockable in Tests)

The invitation sending logic is abstracted behind an **interface** (`InvitationSender`). This allows:

- **Production**: Uses the Auth0 implementation (`Auth0InvitationSenderService`).
- **Tests**: Uses a mock/no-op implementation injected via NestJS DI.
- **Future**: Easy to swap to another provider (e.g., SendGrid, custom email) without touching business logic.

### Auth0 Management API Authentication

To call Auth0's Management API, we need an access token. This is obtained via the **Client Credentials Grant** using a Machine-to-Machine (M2M) application configured in the Auth0 dashboard.

---

## 1. Environment Variables

### New Variables

| Variable                  | Description                                                       | Example                              |
|---------------------------|-------------------------------------------------------------------|--------------------------------------|
| `AUTH0_ORGANIZATION_ID`   | The single Auth0 organization ID                                  | `org_xxxxxxxxxxxxxxxx`               |
| `AUTH0_M2M_CLIENT_ID`     | Client ID of the Auth0 M2M application (for Management API)      | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`   |
| `AUTH0_M2M_CLIENT_SECRET` | Client secret of the Auth0 M2M application                       | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`   |
| `AUTH0_CLIENT_ID`         | Client ID of the web SPA application (used in invitation link)    | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`   |

### Existing Variables (already configured)

| Variable           | Description                   | Value                                         |
|--------------------|-------------------------------|-----------------------------------------------|
| `AUTH0_ISSUER_URL` | Auth0 tenant issuer URL       | `https://your-tenant.auth0.com/`          |
| `AUTH0_AUDIENCE`   | Auth0 API audience            | `https://your-tenant.auth0.com/api/v2/`   |

> **Note**: The Auth0 domain (`your-tenant.auth0.com`) is derived from `AUTH0_ISSUER_URL` by stripping the protocol and trailing slash. No need for a separate `AUTH0_DOMAIN` variable.

---

## 2. Interface: `InvitationSender`

**File**: `apps/api/src/domains/auth/invitation-sender.interface.ts`

```typescript
export const INVITATION_SENDER = Symbol("INVITATION_SENDER")

export interface SendInvitationParams {
  inviteeEmail: string
  inviterName: string
  metadata?: Record<string, string>
}

export interface InvitationSender {
  sendInvitation(params: SendInvitationParams): Promise<void>
}
```

### Design Notes

- `INVITATION_SENDER` is a NestJS injection token (symbol). It's used for DI: `@Inject(INVITATION_SENDER)`.
- `inviteeEmail`: the email address of the person being invited.
- `inviterName`: the name of the user who triggered the invitation (displayed in the Auth0 email template).
- `metadata`: optional key-value pairs passed as `user_metadata` to Auth0. We use this to pass our `invitationToken` UUID.

---

## 3. Auth0 Implementation: `Auth0InvitationSenderService`

**File**: `apps/api/src/domains/auth/auth0-invitation-sender.service.ts`

### Responsibilities

1. **Obtain a Management API access token** via the Client Credentials Grant:
   - `POST https://{domain}/oauth/token`
   - Body: `{ client_id, client_secret, audience: "https://{domain}/api/v2/", grant_type: "client_credentials" }`
   - Caches the token until close to expiry.

2. **Send the invitation** via Auth0's Organizations API:
   - `POST https://{domain}/api/v2/organizations/{orgId}/invitations`
   - Headers: `Authorization: Bearer {managementToken}`
   - Body:
     ```json
     {
       "inviter": { "name": "{inviterName}" },
       "invitee": { "email": "{inviteeEmail}" },
       "client_id": "{AUTH0_CLIENT_ID}",
       "send_invitation_email": true,
       "user_metadata": { "invitationToken": "{uuid}" }
     }
     ```

### Token Caching

The M2M access token is cached in memory. The Auth0 token response includes an `expires_in` field (in seconds). We store the token alongside its expiry timestamp and refresh it with a safety margin (e.g., 60 seconds before actual expiry).

```typescript
private cachedToken: { token: string; expiresAt: number } | null = null

private isTokenExpired(): boolean {
  if (!this.cachedToken) return true
  // Refresh 60 seconds before actual expiry
  return Date.now() >= this.cachedToken.expiresAt - 60_000
}
```

### Error Handling

- If the Management API token request fails → log error and throw `InternalServerErrorException`.
- If the invitation request fails → log error and throw `InternalServerErrorException` with the Auth0 error message.
- **Decision: fail loudly + rollback** — the entire `inviteProjectMembers` method runs inside a SQL transaction (see §5). If the Auth0 invitation fails, the transaction rolls back and no records are persisted (no user, no membership). This guarantees consistency: we never have DB records without a corresponding Auth0 invitation.

### Implementation Sketch

```typescript
@Injectable()
export class Auth0InvitationSenderService implements InvitationSender {
  private cachedToken: { token: string; expiresAt: number } | null = null

  constructor(private readonly configService: ConfigService) {}

  async sendInvitation(params: SendInvitationParams): Promise<void> {
    const domain = this.getDomain()
    const orgId = this.configService.getOrThrow<string>("AUTH0_ORGANIZATION_ID")
    const clientId = this.configService.getOrThrow<string>("AUTH0_CLIENT_ID")
    const accessToken = await this.getManagementToken()

    const response = await fetch(
      `https://${domain}/api/v2/organizations/${orgId}/invitations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          inviter: { name: params.inviterName },
          invitee: { email: params.inviteeEmail },
          client_id: clientId,
          send_invitation_email: true,
          ...(params.metadata && { user_metadata: params.metadata }),
        }),
      },
    )

    if (!response.ok) {
      const errorBody = await response.text()
      throw new InternalServerErrorException(
        `Failed to send Auth0 invitation: ${response.status} ${errorBody}`,
      )
    }
  }

  private async getManagementToken(): Promise<string> {
    if (!this.isTokenExpired()) {
      return this.cachedToken!.token
    }

    const domain = this.getDomain()
    const clientId = this.configService.getOrThrow<string>("AUTH0_M2M_CLIENT_ID")
    const clientSecret = this.configService.getOrThrow<string>("AUTH0_M2M_CLIENT_SECRET")

    const response = await fetch(`https://${domain}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        audience: `https://${domain}/api/v2/`,
        grant_type: "client_credentials",
      }),
    })

    if (!response.ok) {
      throw new InternalServerErrorException("Failed to obtain Auth0 Management API token")
    }

    const data = await response.json()
    this.cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    }

    return this.cachedToken.token
  }

  private getDomain(): string {
    const issuerUrl = this.configService.getOrThrow<string>("AUTH0_ISSUER_URL")
    return issuerUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
  }

  private isTokenExpired(): boolean {
    if (!this.cachedToken) return true
    return Date.now() >= this.cachedToken.expiresAt - 60_000
  }
}
```

---

## 4. Module Registration

**File**: `apps/api/src/domains/auth/auth.module.ts`

Register the `INVITATION_SENDER` token with the Auth0 implementation:

```typescript
@Module({
  imports: [ConfigModule, PassportModule.register({ defaultStrategy: "jwt" })],
  providers: [
    JwtStrategy,
    Auth0UserInfoService,
    {
      provide: INVITATION_SENDER,
      useClass: Auth0InvitationSenderService,
    },
  ],
  exports: [PassportModule, Auth0UserInfoService, INVITATION_SENDER],
})
export class AuthModule {}
```

---

## 5. Integration with `ProjectMembershipsService`

**File**: `apps/api/src/domains/projects/memberships/project-memberships.service.ts`

### Changes

1. **Inject** `InvitationSender` via the `INVITATION_SENDER` token.
2. **Inject** `DataSource` for transaction support.
3. **Update** `inviteProjectMembers` signature to also accept `inviterName: string`.
4. **Wrap** the entire invite loop in a SQL transaction via `dataSource.transaction()`.
5. **Call** `invitationSender.sendInvitation()` after creating each membership — inside the transaction.

### Transaction Strategy

The whole `inviteProjectMembers` method runs inside a single SQL transaction. All database operations (user creation, membership creation) use the transactional `EntityManager` instead of the injected repositories. If any step fails — including the Auth0 API call — the transaction is rolled back and **no records are persisted**.

This ensures we never have "orphan" memberships in the database that don't have a corresponding Auth0 invitation.

```typescript
@Injectable()
export class ProjectMembershipsService {
  constructor(
    @InjectRepository(ProjectMembership)
    private readonly projectMembershipRepository: Repository<ProjectMembership>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(INVITATION_SENDER)
    private readonly invitationSender: InvitationSender,
    private readonly dataSource: DataSource,
  ) {}

  async inviteProjectMembers(
    projectId: string,
    emails: string[],
    inviterName: string,
  ): Promise<ProjectMembership[]> {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User)
      const membershipRepo = manager.getRepository(ProjectMembership)
      const createdMemberships: ProjectMembership[] = []

      for (const email of emails) {
        const normalizedEmail = email.trim().toLowerCase()

        // Find or create user (using transactional manager)
        let user = await userRepo.findOne({
          where: { email: normalizedEmail },
        })

        if (!user) {
          const placeholderAuth0Id = `${PLACEHOLDER_AUTH0_ID_PREFIX}${randomUUID().slice(-12)}`
          user = userRepo.create({
            auth0Id: placeholderAuth0Id,
            email: normalizedEmail,
            name: null,
            pictureUrl: null,
          })
          user = await userRepo.save(user)
        }

        // Check if membership already exists
        const existingMembership = await membershipRepo.findOne({
          where: { projectId, userId: user.id },
        })

        if (existingMembership) {
          continue
        }

        // Create membership (using transactional manager)
        const membership = membershipRepo.create({
          projectId,
          userId: user.id,
          invitationToken: randomUUID(),
          status: "sent",
        })

        const savedMembership = await membershipRepo.save(membership)
        savedMembership.user = user

        // Send Auth0 invitation — if this throws, the entire transaction rolls back
        await this.invitationSender.sendInvitation({
          inviteeEmail: normalizedEmail,
          inviterName,
          metadata: { invitationToken: savedMembership.invitationToken },
        })

        createdMemberships.push(savedMembership)
      }

      return createdMemberships
    })
  }

  // ... rest unchanged (findById, listProjectMemberships, removeProjectMembership) ...
}
```

### Controller Update

**File**: `apps/api/src/domains/projects/memberships/project-memberships.controller.ts`

Pass the inviter's name (from `request.user`) to the service:

```typescript
@Post(ProjectsRoutes.inviteProjectMembers.path)
@CheckPolicy((policy) => policy.canCreate())
async inviteProjectMembers(
  @Req() request: EndpointRequestWithProject,
  @Body() body: typeof ProjectsRoutes.inviteProjectMembers.request,
): Promise<typeof ProjectsRoutes.inviteProjectMembers.response> {
  const { project, user } = request

  const memberships = await this.projectMembershipsService.inviteProjectMembers(
    project.id,
    body.payload.emails,
    user.name ?? user.email,  // Fallback to email if name is null
  )

  return {
    data: {
      memberships: memberships.map(toProjectMembershipDto),
    },
  }
}
```

---

## 6. Testing

### 6.1 Mocking `InvitationSender` in Existing Tests

In `project-memberships.service.spec.ts` and e2e tests, override the `INVITATION_SENDER` provider with a no-op mock:

```typescript
const mockInvitationSender: InvitationSender = {
  sendInvitation: jest.fn().mockResolvedValue(undefined),
}

// In test module setup:
setup = await setupTransactionalTestDatabase({
  additionalImports: [ProjectsModule],
  overrideProviders: [
    { provide: INVITATION_SENDER, useValue: mockInvitationSender },
  ],
})
```

> **Note**: `setupTransactionalTestDatabase` may need to be updated to support `overrideProviders`. If it doesn't support it yet, we can use NestJS's `TestingModule.overrideProvider()` API during module creation.

Tests can then verify:
- `mockInvitationSender.sendInvitation` was called with the correct arguments.
- `mockInvitationSender.sendInvitation` was called the expected number of times (once per created membership, not for skipped duplicates).

### 6.2 Unit Tests for `Auth0InvitationSenderService`

**File**: `apps/api/src/domains/auth/auth0-invitation-sender.service.spec.ts`

Test cases:
- **Happy path**: Mocks `fetch` to return success for token + invitation → verifies correct API calls.
- **Token caching**: Calls `sendInvitation` twice → verifies the token endpoint is called only once.
- **Token refresh**: Simulates an expired cached token → verifies the token endpoint is called again.
- **Token request failure**: Mocks token endpoint to return 401 → verifies `InternalServerErrorException`.
- **Invitation request failure**: Mocks invitation endpoint to return 400 → verifies `InternalServerErrorException` with error message.
- **Missing config**: Verifies proper error when required env vars are missing.

### 6.3 E2E Test Considerations

E2e tests (`create-for-target.spec.ts`, `auth.spec.ts`) will use the mocked `InvitationSender`, so they don't make real Auth0 API calls. The mock is automatically provided by the test module setup.

---

## 7. File Summary

### New Files

| File                                                                 | Description                                      |
|----------------------------------------------------------------------|--------------------------------------------------|
| `apps/api/src/domains/auth/invitation-sender.interface.ts`           | Interface + injection token                      |
| `apps/api/src/domains/auth/auth0-invitation-sender.service.ts`       | Auth0 implementation                             |
| `apps/api/src/domains/auth/auth0-invitation-sender.service.spec.ts`  | Unit tests for Auth0 implementation              |

### Modified Files

| File                                                                           | Changes                                                  |
|--------------------------------------------------------------------------------|----------------------------------------------------------|
| `apps/api/src/domains/auth/auth.module.ts`                                     | Register `INVITATION_SENDER` provider, export it         |
| `apps/api/src/domains/projects/memberships/project-memberships.service.ts`     | Inject `InvitationSender`, call it after creating membership, add `inviterName` param |
| `apps/api/src/domains/projects/memberships/project-memberships.controller.ts`  | Pass `user.name ?? user.email` as `inviterName`          |
| `apps/api/src/domains/projects/memberships/project-memberships.service.spec.ts`| Mock `INVITATION_SENDER`, assert it's called correctly   |
| `apps/api/src/domains/projects/memberships/e2e-tests/*.spec.ts`                | Provide mock `INVITATION_SENDER` in test setup           |

### Environment / Config

| File                | Changes                                                             |
|---------------------|---------------------------------------------------------------------|
| `apps/api/.env`     | Add `AUTH0_ORGANIZATION_ID`, `AUTH0_M2M_CLIENT_ID`, `AUTH0_M2M_CLIENT_SECRET`, `AUTH0_CLIENT_ID` |
| `Makefile`          | Add new env vars / secrets to Cloud Run deploy command              |
| `README.md`         | Document new env vars                                               |

---

## 8. Auth0 Dashboard Prerequisites

Before this feature works, the following must be configured in the Auth0 dashboard:

1. **Create an M2M Application** (if not already existing):
   - Application Type: Machine to Machine
   - Authorize it for the **Auth0 Management API** (`https://your-tenant.auth0.com/api/v2/`)
   - Grant the following scopes:
     - `create:organization_invitations`
     - `read:organization_invitations` (optional, for future use)
   - Note its `Client ID` and `Client Secret` → these become `AUTH0_M2M_CLIENT_ID` and `AUTH0_M2M_CLIENT_SECRET`

2. **Note the Organization ID**:
   - Go to Organizations → select the default organization
   - Copy its ID (e.g., `org_xxxxxxxxxxxxxxxx`) → this becomes `AUTH0_ORGANIZATION_ID`

3. **Note the Web SPA Application Client ID**:
   - Go to Applications → select the web SPA app
   - Copy its `Client ID` → this becomes `AUTH0_CLIENT_ID`
   - This is the same value as `VITE_AUTH0_CLIENT_ID` on the frontend

---

## 9. Sequence Diagram

```
Admin User                Controller              Service                InvitationSender (Auth0)         Auth0 API
    │                          │                      │                          │                            │
    │  POST /invite            │                      │                          │                            │
    │  { emails: [...] }       │                      │                          │                            │
    │─────────────────────────>│                      │                          │                            │
    │                          │  inviteProjectMembers│                          │                            │
    │                          │  (projectId, emails, │                          │                            │
    │                          │   inviterName)        │                          │                            │
    │                          │─────────────────────>│                          │                            │
    │                          │                      │  for each email:         │                            │
    │                          │                      │  find/create user        │                            │
    │                          │                      │  create membership       │                            │
    │                          │                      │                          │                            │
    │                          │                      │  sendInvitation({        │                            │
    │                          │                      │    inviteeEmail,         │                            │
    │                          │                      │    inviterName,          │                            │
    │                          │                      │    metadata: {           │                            │
    │                          │                      │      invitationToken     │                            │
    │                          │                      │    }                     │                            │
    │                          │                      │  })                      │                            │
    │                          │                      │─────────────────────────>│                            │
    │                          │                      │                          │  POST /oauth/token          │
    │                          │                      │                          │  (if token expired)         │
    │                          │                      │                          │───────────────────────────>│
    │                          │                      │                          │  { access_token }           │
    │                          │                      │                          │<───────────────────────────│
    │                          │                      │                          │                            │
    │                          │                      │                          │  POST /organizations/       │
    │                          │                      │                          │    {orgId}/invitations      │
    │                          │                      │                          │───────────────────────────>│
    │                          │                      │                          │  201 Created                │
    │                          │                      │                          │<───────────────────────────│
    │                          │                      │                          │                            │
    │                          │                      │<─────────────────────────│                            │
    │                          │                      │                          │                            │
    │                          │  memberships[]       │                          │                            │
    │                          │<─────────────────────│                          │                            │
    │  { data: { memberships } }│                     │                          │                            │
    │<─────────────────────────│                      │                          │                            │
```

---

## 10. Open Questions / Future Considerations

1. **Invitation acceptance flow**: When the invitee clicks the Auth0 invitation link and signs up / logs in, we need to update the `ProjectMembership.status` from `"sent"` to `"accepted"`. This can be done via:
   - An Auth0 post-login Action that calls our API.
   - Checking on each login whether the user has pending invitations.
   - A dedicated callback endpoint.
   → Deferred to a future iteration.

2. **Retry / resilience**: The SQL transaction ensures DB consistency if Auth0 fails. However, the reverse can happen: Auth0 invitation sent but DB commit fails (unlikely but possible). For now this edge case is accepted. A retry queue or outbox pattern could be added later if needed.

3. **Rate limiting**: Auth0 Management API has rate limits. If we invite many users at once, we may need to batch/throttle. For now, this is not a concern since invitation lists are small.
