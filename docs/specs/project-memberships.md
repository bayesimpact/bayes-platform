# Feature Specification: Project Memberships (External User Invitations)

## Overview

Organization owners and administrators need the ability to invite external users to access the conversational agents of a specific project. This feature introduces a **Project Membership** system that ties a user to a project via an invitation workflow.

---

## Domain Decision

> **Decision**: Place the new controllers, services, and entity within the existing **`projects`** domain, inside a dedicated **`memberships`** subfolder.
>
> **Rationale**: Project memberships are tightly scoped to projects — they don't exist independently. The existing `projects` domain already owns CRUD for projects, and project memberships are a natural extension of that ownership. The `memberships/` subfolder keeps the domain organized without introducing cross-module coupling. If the feature grows significantly (e.g., invitation emails, invitation workflows, etc.), it can be extracted into its own module later.

---

## 1. Database / Entity Layer (API)

### 1.1 Entity: `ProjectMembership`

**Table name**: `project_membership`

| Column             | Type        | Constraints                                   | Description                                   |
|--------------------|-------------|-----------------------------------------------|-----------------------------------------------|
| `id`               | `uuid`      | PK, auto-generated                            | Primary key                                   |
| `project_id`       | `uuid`      | FK → `project.id`, NOT NULL                   | The project this membership belongs to        |
| `user_id`          | `uuid`      | FK → `user.id`, NOT NULL                      | The invited user                              |
| `invitation_token` | `varchar`   | UNIQUE, NOT NULL                              | Unique token for the invitation link          |
| `status`           | `varchar`   | NOT NULL, default `'sent'`                    | Invitation status: `'sent'` or `'accepted'`   |
| `created_at`       | `timestamp` | auto-generated                                | Creation timestamp                            |
| `updated_at`       | `timestamp` | auto-generated                                | Last update timestamp                         |

**Constraints**:
- `UNIQUE(project_id, user_id)` — A user can only have one membership per project.

**File**: `apps/api/src/domains/projects/memberships/project-membership.entity.ts`

```typescript
export type ProjectMembershipStatus = "sent" | "accepted"

@Entity("project_membership")
@Unique(["projectId", "userId"])
export class ProjectMembership {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column({ type: "uuid", name: "project_id" })
  projectId!: string

  @Column({ type: "uuid", name: "user_id" })
  userId!: string

  @Column({ type: "varchar", name: "invitation_token", unique: true })
  invitationToken!: string

  @Column({ type: "varchar", default: "sent" })
  status!: ProjectMembershipStatus

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date

  // Relations
  @ManyToOne(() => Project, (project) => project.projectMemberships)
  @JoinColumn({ name: "project_id" })
  project!: Project

  @ManyToOne(() => User, (user) => user.projectMemberships)
  @JoinColumn({ name: "user_id" })
  user!: User
}
```

**Notes**:
- The `invitation_token` stores the Auth0 `ticket_id` returned when sending an organization invitation. This ticket_id is used by the web app to accept the invitation after the user authenticates via Auth0.
- No roles on project memberships for now — presence in the table implies access.

### 1.2 Relationships

- **`Project`** entity has a `@OneToMany` → `ProjectMembership[]` relation (`projectMemberships`).
- **`User`** entity has a `@OneToMany` → `ProjectMembership[]` relation (`projectMemberships`).

### 1.3 Migration

- A TypeORM migration was generated via `npm run migration:generate`.
- **File**: `apps/api/src/migrations/1770803458597-create-project-membership.ts`

---

## 2. API Contracts (`packages/api-contracts`)

### 2.1 DTOs

**File**: `packages/api-contracts/src/projects/projects.dto.ts` (appended to existing file)

```typescript
// --- Project Membership DTOs ---

export type ProjectMembershipDto = {
  id: string
  projectId: string
  userId: string
  userName: string | null
  userEmail: string
  status: "sent" | "accepted"
  createdAt: TimeType
}

export type ListProjectMembershipsResponseDto = {
  memberships: ProjectMembershipDto[]
}

export type InviteProjectMembersRequestDto = {
  emails: string[]
}

export type InviteProjectMembersResponseDto = {
  memberships: ProjectMembershipDto[]
}

export type RemoveProjectMembershipResponseDto = {
  success: true
}
```

### 2.2 Routes

**File**: `packages/api-contracts/src/projects/projects.routes.ts` (appended to existing `ProjectsRoutes`)

| Route Name                    | Method   | Path                                                                     | Request DTO                          | Response DTO                            |
|-------------------------------|----------|--------------------------------------------------------------------------|--------------------------------------|-----------------------------------------|
| `listProjectMemberships`      | `GET`    | `organizations/:organizationId/projects/:projectId/memberships`          | —                                    | `ListProjectMembershipsResponseDto`     |
| `inviteProjectMembers`        | `POST`   | `invitations` (see `InvitationsRoutes.createForTarget`, `targetType: "project"`) | `CreateInvitationsRequestDto` | `CreateInvitationsResponseDto`          |
| `removeProjectMembership`     | `DELETE` | `organizations/:organizationId/projects/:projectId/memberships/:membershipId` | —                                | `RemoveProjectMembershipResponseDto`    |

**Route definitions** (added to the existing `ProjectsRoutes` object):

```typescript
listProjectMemberships: defineRoute<ResponseData<ListProjectMembershipsResponseDto>>({
  method: "get",
  path: "organizations/:organizationId/projects/:projectId/memberships",
}),
// Project invites: use InvitationsRoutes.createForTarget (POST invitations) with targetType "project".
removeProjectMembership: defineRoute<ResponseData<RemoveProjectMembershipResponseDto>>({
  method: "delete",
  path: "organizations/:organizationId/projects/:projectId/memberships/:membershipId",
}),
```

### 2.3 Exports

The new DTOs and routes are exported from `packages/api-contracts/src/index.ts` (already covered by the existing `export type * from "./projects/projects.dto"` and `export { ProjectsRoutes }` lines — no changes needed there since we append to existing files).

---

## 3. API Service Layer

### 3.1 Service: `ProjectMembershipsService`

**File**: `apps/api/src/domains/projects/memberships/project-memberships.service.ts`

Methods on `ProjectMembershipsService`:

| Method                      | Description                                                                                          |
|-----------------------------|------------------------------------------------------------------------------------------------------|
| `findById(membershipId: string)` | Returns a project membership by its ID (used by the guard to fetch the entity). |
| `listProjectMemberships(projectId: string)` | Returns all project memberships for a project, with user relations eagerly loaded.   |
| `inviteProjectMembers(projectId: string, emails: string[], inviterName: string)` | For each email: find or create a user, send Auth0 invitation, create a `ProjectMembership` with status `sent` and the Auth0 `ticket_id` as `invitationToken`. Skips duplicates. Returns created memberships. Runs in a SQL transaction. |
| `acceptInvitation(ticketId: string, auth0Sub: string)` | Accepts an invitation by ticket_id. Reconciles placeholder user, creates org membership, marks as accepted. Runs in a SQL transaction. |
| `removeProjectMembership(membershipId: string, projectId: string)` | Removes a project membership. Also deletes placeholder users. Runs in a SQL transaction. |

**Invitation logic detail** (`inviteProjectMembers`):
1. For each email in the list:
   - Look up the `User` by email (normalized to lowercase).
   - If no user exists, create one with a **unique** placeholder `auth0Id` set to `"00000000-0000-0000-0000-"` + a random 12-character suffix (via `randomUUID().slice(-12)`). Each new user gets a unique placeholder to avoid unique constraint violations. The user record acts as a pre-provisioned entry. This placeholder will be updated when the user accepts the invitation.
   - Check if a `ProjectMembership` already exists for `(projectId, userId)` — if so, skip.
   - Send an Auth0 organization invitation via the `InvitationSender` interface (see §3.2). Auth0 sends the invitation email and returns a `ticket_id`.
   - Create a `ProjectMembership` with `status: "sent"` and `invitationToken` set to the Auth0 `ticket_id`.
2. Return all created memberships (with user relations loaded).

**Acceptance logic detail** (`acceptInvitation`):
1. Look up the `ProjectMembership` by `invitationToken` (the Auth0 `ticket_id`).
2. If not found, throw `NotFoundException`.
3. If already accepted, return as-is (idempotent).
4. If the user has a placeholder `auth0Id` (starts with `"00000000-0000-0000-0000-"`), reconcile it with the real `auth0Sub` from the JWT.
5. Create a `UserMembership` (organization membership) with role `"member"` for the user in the project's organization, if one doesn't already exist.
6. Update the membership `status` to `"accepted"`.

> **Critical ordering note**: The `acceptInvitation` endpoint must be called **before** `/me` (which runs `UserGuard.findOrCreate`). If `/me` runs first, it would create a duplicate user since no user with the real `auth0Id` exists yet. The web app's auth middleware enforces this ordering (see §11.2).

**Removal logic detail** (`removeProjectMembership`):
1. Look up the `ProjectMembership` by ID with its user relation.
2. Delete the membership.
3. If the associated user has a placeholder `auth0Id` (never accepted the invitation), also delete the orphaned placeholder user.

### 3.2 Auth0 Invitation Sender

**Interface**: `apps/api/src/domains/auth/invitation-sender.interface.ts`

```typescript
export const INVITATION_SENDER = Symbol("INVITATION_SENDER")

export interface SendInvitationParams {
  inviteeEmail: string
  inviterName: string
}

export interface SendInvitationResult {
  ticketId: string
}

export interface InvitationSender {
  sendInvitation(params: SendInvitationParams): Promise<SendInvitationResult>
}
```

**Implementation**: `apps/api/src/domains/auth/auth0-invitation-sender.service.ts`

The `Auth0InvitationSenderService` sends organization invitations via the Auth0 Management API:

1. Obtains a Management API access token (client credentials grant, cached).
2. Calls `POST /api/v2/organizations/{orgId}/invitations` with the invitee email and inviter name.
3. Auth0 sends the invitation email automatically (`send_invitation_email: true`).
4. Returns the `ticket_id` from Auth0's response — this is stored as the `invitationToken` on the `ProjectMembership`.

The invitation email contains a link to the **Application Login URI** with query parameters: `?invitation={ticket_id}&organization={org_id}&organization_name={org_name}`.

---

## 4. API Controller Layer

### 4.1 Controller: `ProjectMembershipsController`

**File**: `apps/api/src/domains/projects/memberships/project-memberships.controller.ts`

Endpoints:

| Method             | Decorator               | Policy Check                        | Request Type                                 | Notes                                                    |
|--------------------|-------------------------|-------------------------------------|----------------------------------------------|----------------------------------------------------------|
| `listProjectMemberships`  | `@Get(...)` | `canList()`                         | `EndpointRequestWithProject`                 | Returns memberships for the project                      |
| `inviteProjectMembers`    | `@Post(...)` | `canCreate()`                      | `EndpointRequestWithProject` + Body          | Accepts `{ payload: { emails: string[] } }`              |
| `removeProjectMembership` | `@Delete(...)` | `canDelete()`                   | `EndpointRequestWithProjectMembership`       | `projectMembership` from request (set by context resolver) |

**DTO mapping**: A `toProjectMembershipDto` helper function maps `ProjectMembership` entities to DTOs.

### 4.2 Context Resolvers and Guards

The request flow uses context resolvers, not cascading resource-loading guards:

`JwtAuthGuard → UserGuard → ResourceContextGuard → ProjectMembershipsGuard`

`ResourceContextGuard` resolves resources declared with metadata:
- Class-level: `@RequireContext("organization", "project")`
- Route-level: `@AddContext("projectMembership")` on remove route

This means `ProjectMembershipsGuard` only performs policy evaluation.

#### `ProjectMembershipsGuard`

**File**: `apps/api/src/domains/projects/memberships/project-memberships.guard.ts`

A dedicated policy guard for project memberships. It:

1. Runs **after** `ResourceContextGuard`, so request context has already been resolved.
2. Instantiates a `ProjectMembershipPolicy` with `(userMembership, project, projectMembership?)`.
3. Reads the `@CheckPolicy` decorator handler via the `Reflector` and evaluates it.
4. Throws `ForbiddenException` if the policy check fails.

#### `ProjectMembershipContextResolver`

**File**: `apps/api/src/common/context/resolvers/project-membership-context.resolver.ts`

This resolver loads `request.projectMembership` when `membershipId` is required:

1. Reads `membershipId` from route params.
2. Throws `NotFoundException` if missing/placeholder.
3. Fetches the membership scoped to the already-resolved `request.project.id`.
4. Throws `NotFoundException` if not found.
5. Sets `request.projectMembership`.

#### `EndpointRequestWithProjectMembership`

**File**: `apps/api/src/common/context/request.interface.ts`

```typescript
export interface EndpointRequestWithProjectMembership extends EndpointRequestWithProject {
  projectMembership: ProjectMembership
}
```

This extends the request type chain: `EndpointRequest → EndpointRequestWithUserMembership → EndpointRequestWithProject → EndpointRequestWithProjectMembership`.

### 4.3 Policy

**File**: `apps/api/src/domains/projects/memberships/project-membership.policy.ts`

A dedicated policy for project memberships, extending `ProjectScopedPolicy<ProjectMembership>`:

```typescript
import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"
import type { ProjectMembership } from "./project-membership.entity"

export class ProjectMembershipPolicy extends ProjectScopedPolicy<ProjectMembership> {
  // the default project-scoped policy is enough
}
```

The `ProjectScopedPolicy<T>` base class provides RESTful methods that handle project-scoping automatically:

- **`canList()`**: Returns `true` if the user is an admin or owner of the organization.
- **`canCreate()`**: Returns `true` if the resource belongs to the organization and the user is an admin or owner.
- **`canUpdate()`**: Same as `canCreate()`.
- **`canDelete()`**: Same as `canCreate()`, plus verifies the resource belongs to the correct project.

**Authorization rules**:
- Only **owners** and **admins** of the organization can list, invite, or remove project memberships.
- Regular **members** of the organization cannot perform these actions.
- The sidebar icon in the webapp is **hidden** for non-admin/non-owner users.

---

## 5. API Module

**File**: `apps/api/src/domains/projects/projects.module.ts`

- `ProjectMembership` and `User` added to `TypeOrmModule.forFeature([...])`.
- `ProjectMembershipsController` registered in `controllers` (imported from `./memberships/project-memberships.controller`).
- `ProjectMembershipsService` registered in `providers` (imported from `./memberships/project-memberships.service`).

---

## 6. Invitation Acceptance (API)

### 6.1 API Contracts

**File**: `packages/api-contracts/src/invitations/invitations.dto.ts`

```typescript
export type AcceptInvitationRequestDto = {
  ticketId: string
}

export type AcceptInvitationResponseDto = {
  success: true
}
```

**File**: `packages/api-contracts/src/invitations/invitations.routes.ts`

| Route Name          | Method | Path                 | Request DTO                    | Response DTO                    |
|---------------------|--------|----------------------|--------------------------------|---------------------------------|
| `acceptInvitation`  | `POST` | `invitations/accept` | `AcceptInvitationRequestDto`   | `AcceptInvitationResponseDto`   |

### 6.2 Controller: `InvitationsController`

**File**: `apps/api/src/domains/invitations/invitations.controller.ts`

A separate controller in its own `invitations` domain, dedicated to invitation acceptance.

**Important**: This controller is guarded by `JwtAuthGuard` **only** — no `UserGuard`. This is critical because `acceptInvitation` must reconcile the placeholder user's `auth0Id` with the real one *before* `UserGuard.findOrCreate` runs (which happens on `/me`). If `UserGuard` were present, it would create a duplicate user.

```typescript
@UseGuards(JwtAuthGuard)
@Controller()
export class InvitationsController {
  constructor(private readonly projectMembershipsService: ProjectMembershipsService) {}

  @Post(InvitationsRoutes.acceptOne.path)
  async acceptInvitation(
    @Req() request: { user: JwtPayload },
    @Body() body: typeof InvitationsRoutes.acceptOne.request,
  ): Promise<typeof InvitationsRoutes.acceptOne.response> {
    const jwtPayload = request.user
    await this.projectMembershipsService.acceptInvitation(body.payload.ticketId, jwtPayload.sub)
    return { data: { success: true } }
  }
}
```

### 6.3 Module: `InvitationsModule`

**File**: `apps/api/src/domains/invitations/invitations.module.ts`

```typescript
@Module({
  imports: [AuthModule, UsersModule, ProjectsModule],
  controllers: [InvitationsController],
})
export class InvitationsModule {}
```

Registered in `AppModule`.

---

## 7. Tests (API)

### 7.1 E2E Tests

#### `apps/api/src/domains/projects/memberships/e2e-tests/auth.spec.ts` (**dedicated auth spec**)

A separate auth test file for project memberships (decoupled from `projects/e2e-tests/auth.spec.ts`):

- `ProjectsRoutes.listProjectMemberships`:
  - Requires authentication token
  - Requires valid organization ID
  - Requires user to be a member of the organization
  - Requires existing project ID
  - Denies `member` role → `403`
  - Allows `admin` role → `200`
  - Allows `owner` role → `200`

- `ProjectsRoutes.inviteProjectMembers`:
  - Same auth checks as above
  - Denies `member` role → `403`

- `ProjectsRoutes.removeProjectMembership`:
  - Same auth checks
  - Requires existing membership ID → `404` if not found
  - Requires membership to belong to the project → `403`
  - Denies `member` role → `403`

#### `apps/api/src/domains/projects/memberships/e2e-tests/list-project-memberships.spec.ts`

- Returns empty list when no memberships exist
- Returns memberships with user name and email
- Only returns memberships for the specified project (not other projects)

#### `apps/api/src/domains/invitations/e2e-tests/create-for-target.spec.ts`

- `targetType: "project"`: pending invitation for a new email (no user row until accept); activity `invitation.invite`
- `targetType: "project"`: invitation linked to an existing user’s `userId`
- Invitation sender invoked once per email

#### `apps/api/src/domains/projects/memberships/e2e-tests/delete-one.spec.ts`

- Successfully removes a membership
- Returns `404` for non-existent membership ID
- Returns `404` if membership belongs to a different project
- Verifies the membership is actually deleted from the database
- Deletes the placeholder user when removing a pending invitation
- Does NOT delete a real user when removing their membership

#### `apps/api/src/domains/invitations/e2e-tests/accept-invitation.spec.ts`

- Accepts an invitation and returns success
- Updates the membership status to `"accepted"`
- Creates an organization membership (role `"member"`) for the invitee
- Returns `404` for an unknown ticketId
- Is idempotent — accepting an already accepted invitation returns success
- Returns `404` when ticketId does not match any invitation

### 7.2 Service Tests

**File**: `apps/api/src/domains/projects/memberships/project-memberships.service.spec.ts`

- Test `findById` method (returns membership, returns null for non-existent)
- Test `listProjectMemberships` method
- Test `inviteProjectMembers` method (user creation, duplicate handling, email normalization, Auth0 invitation sending)
- Test `acceptInvitation` method:
  - Reconciles placeholder user's auth0Id
  - Creates organization membership (role `"member"`)
  - Does not duplicate org membership if one already exists
  - Returns membership if already accepted (idempotent)
  - Throws `NotFoundException` for unknown ticketId
  - Does not overwrite auth0Id if user is not a placeholder
- Test `removeProjectMembership` method:
  - Removes the membership
  - Also deletes the placeholder user when removing a pending invitation
  - Does NOT delete a real user when removing a membership

### 7.3 Policy Tests

**File**: `apps/api/src/domains/projects/memberships/project-membership.policy.spec.ts`

- Test `canList()` for owner, admin, member
- Test `canCreate()` for owner, admin, member
- Test `canDelete()` for owner, admin, member × sameProject, differentProject, noMembership

### 7.4 Factory

**File**: `apps/api/src/domains/projects/memberships/project-membership.factory.ts`

Fishery factory for `ProjectMembership` with transient params for `project` and `user`.

---

## 8. Web Frontend

> **Implementation note**: Every pattern described below is derived from the existing codebase. All code matches the conventions already established — same naming, same file structure, same Redux patterns, same component composition.

### 8.1 Feature Architecture

A new `project-memberships` feature is created following the canonical feature pattern (as established by `me`, `agents`, `documents`, etc.).

> **Note**: Even though the API controllers live in the `projects` domain on the backend, the frontend feature is separate (`project-memberships`) to maintain clear separation of concerns and avoid bloating the existing `projects` feature — same rationale as `agents` vs `projects`.

#### 8.1.1 Domain Model

**File**: `features/project-memberships/project-memberships.models.ts`

Domain-level types that slices and components depend on (not raw DTOs):

```typescript
export type ProjectMembership = {
  id: string
  projectId: string
  userId: string
  userName: string | null
  userEmail: string
  status: "sent" | "accepted"
  createdAt: number
}
```

#### 8.1.2 SPI (Service Provider Interface)

**File**: `features/project-memberships/project-memberships.spi.ts`

Declares the interface — only exposes domain models, hides transport details:

```typescript
import type { ProjectMembership } from "./project-memberships.models"

export interface IProjectMembershipsSpi {
  getAll: (params: { organizationId: string; projectId: string }) => Promise<ProjectMembership[]>
  invite: (
    params: { organizationId: string; projectId: string },
    emails: string[],
  ) => Promise<ProjectMembership[]>
  removeOne: (params: {
    organizationId: string
    projectId: string
    membershipId: string
  }) => Promise<void>
}
```

> **Convention note**: SPI params use object destructuring (`params: { ... }`) to match the `agents.spi.ts` pattern — not positional arguments.

#### 8.1.3 API Implementation

**File**: `features/project-memberships/external/project-memberships.api.ts`

Concrete Axios implementation. Follows the exact same structure as `agents.api.ts`:

- Uses `getAxiosInstance()` from `@/external/axios`
- Imports routes & DTOs from `@caseai-connect/api-contracts`
- Uses `satisfies IProjectMembershipsSpi` at the end
- Has `fromDto` mapping function at the bottom of the file
- Default export (like `agents.api.ts`)

```typescript
import { type ProjectMembershipDto, ProjectsRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { ProjectMembership } from "../project-memberships.models"
import type { IProjectMembershipsSpi } from "../project-memberships.spi"

export default {
  getAll: async ({ organizationId, projectId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ProjectsRoutes.listProjectMemberships.response>(
      ProjectsRoutes.listProjectMemberships.getPath({ organizationId, projectId }),
    )
    return response.data.data.memberships.map(fromDto)
  },
  invite: async ({ organizationId, projectId }, emails) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ProjectsRoutes.inviteProjectMembers.response>(
      ProjectsRoutes.inviteProjectMembers.getPath({ organizationId, projectId }),
      { payload: { emails } },
    )
    return response.data.data.memberships.map(fromDto)
  },
  removeOne: async ({ organizationId, projectId, membershipId }) => {
    const axios = getAxiosInstance()
    await axios.delete(
      ProjectsRoutes.removeProjectMembership.getPath({ organizationId, projectId, membershipId }),
    )
  },
} satisfies IProjectMembershipsSpi

const fromDto = (dto: ProjectMembershipDto): ProjectMembership => ({
  id: dto.id,
  projectId: dto.projectId,
  userId: dto.userId,
  userName: dto.userName,
  userEmail: dto.userEmail,
  status: dto.status,
  createdAt: dto.createdAt,
})
```

#### 8.1.4 Service Registration

**File**: `external/axios.services.ts` — added import + key:

```typescript
import projectMembershipsApi from "@/features/project-memberships/external/project-memberships.api"

export const services = {
  // ... existing services ...
  projectMemberships: projectMembershipsApi,
}
```

**File**: `di/services.ts` — added to `Services` type:

```typescript
import type { IProjectMembershipsSpi } from "@/features/project-memberships/project-memberships.spi"

export type Services = {
  // ... existing services ...
  projectMemberships: IProjectMembershipsSpi
}
```

#### 8.1.5 Redux Thunks

**File**: `features/project-memberships/project-memberships.thunks.ts`

Follows the exact pattern from `agents.thunks.ts` and `projects.thunks.ts`:

```typescript
import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/store"
import type { ProjectMembership } from "./project-memberships.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listProjectMemberships = createAsyncThunk<
  ProjectMembership[],
  { organizationId: string; projectId: string },
  ThunkConfig
>(
  "projectMemberships/list",
  async (params, { extra: { services } }) =>
    await services.projectMemberships.getAll(params),
)

export const inviteProjectMembers = createAsyncThunk<
  ProjectMembership[],
  { organizationId: string; projectId: string; emails: string[] },
  ThunkConfig
>(
  "projectMemberships/invite",
  async ({ organizationId, projectId, emails }, { extra: { services } }) =>
    await services.projectMemberships.invite({ organizationId, projectId }, emails),
)

export const removeProjectMembership = createAsyncThunk<
  void,
  { organizationId: string; projectId: string; membershipId: string },
  ThunkConfig
>(
  "projectMemberships/remove",
  async (params, { extra: { services } }) =>
    await services.projectMemberships.removeOne(params),
)
```

#### 8.1.6 Redux Slice

**File**: `features/project-memberships/project-memberships.slice.ts`

State shape follows the `agents` pattern — keyed by `projectId` using `AsyncData`:

```typescript
import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/store/async-data-status"
import type { Project } from "../projects/projects.models"
import type { ProjectMembership } from "./project-memberships.models"
import { inviteProjectMembers, listProjectMemberships, removeProjectMembership } from "./project-memberships.thunks"

type DataType = Record<Project["id"], ProjectMembership[]>

interface State {
  data: AsyncData<DataType>
}

const initialState: State = {
  data: defaultAsyncData,
}

const slice = createSlice({
  name: "projectMemberships",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(listProjectMemberships.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listProjectMemberships.fulfilled, (state, action) => {
        const projectId = action.meta.arg.projectId
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: { ...state.data.value, [projectId]: action.payload },
        }
      })
      .addCase(listProjectMemberships.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list project memberships"
      })
  },
})

export type { State as ProjectMembershipsState }
export const projectMembershipsInitialState = initialState
export const projectMembershipsActions = { ...slice.actions }
export const projectMembershipsSliceReducer = slice.reducer
```

#### 8.1.7 Redux Selectors

**File**: `features/project-memberships/project-memberships.selectors.ts`

Follows `agents.selectors.ts` pattern with `AsyncData` returns:

```typescript
import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/store"
import { ADS, type AsyncData } from "@/store/async-data-status"
import type { ProjectMembership } from "./project-memberships.models"

const selectProjectMembershipsData = (state: RootState) => state.projectMemberships.data

export const selectProjectMembershipsFromProjectId = (projectId?: string | null) =>
  createSelector(
    [selectProjectMembershipsData],
    (membershipsData): AsyncData<ProjectMembership[]> => {
      if (!projectId)
        return { status: ADS.Error, value: null, error: "No project selected" }

      if (!ADS.isFulfilled(membershipsData)) return { ...membershipsData }

      if (!membershipsData.value?.[projectId])
        return { status: ADS.Fulfilled, value: [], error: null }

      return { status: ADS.Fulfilled, value: membershipsData.value[projectId], error: null }
    },
  )
```

#### 8.1.8 Redux Middleware (Listener)

**File**: `features/project-memberships/project-memberships.middleware.ts`

Follows the exact `documents.middleware.ts` / `agents.middleware.ts` pattern:

- Refreshes memberships list after invite/remove
- Shows success/error notifications via `notificationsActions.show()`
- Uses `createListenerMiddleware<RootState, AppDispatch>()`

```typescript
import type { TypedStartListening } from "@reduxjs/toolkit"
import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "@/store/types"
import { notificationsActions } from "../notifications/notifications.slice"
import { selectCurrentOrganizationId } from "../organizations/organizations.selectors"
import { selectCurrentProjectId } from "../projects/projects.selectors"
import {
  inviteProjectMembers,
  listProjectMemberships,
  removeProjectMembership,
} from "./project-memberships.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

export type AppStartListening = TypedStartListening<RootState, AppDispatch>

// Refresh memberships after invite or remove
listenerMiddleware.startListening({
  matcher: isAnyOf(inviteProjectMembers.fulfilled, removeProjectMembership.fulfilled),
  effect: async (_, listenerApi) => {
    const state = listenerApi.getState()
    const { organizationId, projectId } = getCurrentIds({ state, wantedIds: ["organizationId", "projectId"] })
    await listenerApi.dispatch(listProjectMemberships({ organizationId, projectId }))
  },
})

// Notification listeners (invite success/error, remove success/error)
listenerMiddleware.startListening({
  actionCreator: inviteProjectMembers.fulfilled,
  effect: async (_, listenerApi) => {
    listenerApi.dispatch(
      notificationsActions.show({ title: "Members invited successfully", type: "success" }),
    )
  },
})
listenerMiddleware.startListening({
  actionCreator: inviteProjectMembers.rejected,
  effect: async (_, listenerApi) => {
    listenerApi.dispatch(
      notificationsActions.show({ title: "Failed to invite members", type: "error" }),
    )
  },
})
listenerMiddleware.startListening({
  actionCreator: removeProjectMembership.fulfilled,
  effect: async (_, listenerApi) => {
    listenerApi.dispatch(
      notificationsActions.show({ title: "Member removed successfully", type: "success" }),
    )
  },
})
listenerMiddleware.startListening({
  actionCreator: removeProjectMembership.rejected,
  effect: async (_, listenerApi) => {
    listenerApi.dispatch(
      notificationsActions.show({ title: "Failed to remove member", type: "error" }),
    )
  },
})

export { listenerMiddleware as projectMembershipsMiddleware }
```

#### 8.1.9 Store Registration

**File**: `store/index.ts` — added reducer + middleware:

```typescript
import { projectMembershipsMiddleware } from "@/features/project-memberships/project-memberships.middleware"
import { projectMembershipsSliceReducer } from "@/features/project-memberships/project-memberships.slice"

// In reducer:
projectMemberships: projectMembershipsSliceReducer,

// In middleware .prepend():
projectMembershipsMiddleware.middleware,
```

**File**: `store/types.ts` — added to `RootState`:

```typescript
import type { projectMembershipsSliceReducer } from "@/features/project-memberships/project-memberships.slice"

// In RootState:
projectMemberships: ReturnType<typeof projectMembershipsSliceReducer>
```

### 8.2 Routing

#### Route Name

**File**: `routes/helpers.ts` — added new enum value:

```typescript
PROJECT_MEMBERSHIPS = "/o/:organizationId/p/:projectId/members"
```

Also added a `buildProjectMembershipsPath` helper (matches the existing `buildDocumentsPath` pattern):

```typescript
export const buildProjectMembershipsPath = ({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) => {
  return buildAdminPath(
    RouteNames.PROJECT_MEMBERSHIPS.toString()
      .replace(":organizationId", organizationId)
      .replace(":projectId", projectId),
  )
}
```

#### Router Config

**File**: `routes/Router.tsx` — added as a child of the `PROJECT` route in the **admin section only** (same level as `DOCUMENTS`):

```typescript
{
  path: buildAdminPath(RouteNames.PROJECT_MEMBERSHIPS),
  element: <ProjectMembershipsRoute />,
},
```

#### Route Component

**File**: `routes/admin/ProjectMembershipsRoute.tsx`

Follows the exact `DocumentsRoute.tsx` pattern:
- Reads `selectCurrentProjectId` and `selectProjectData` from Redux
- Reads `selectProjectMembershipsFromProjectId(projectId)` from the new selectors
- Handles `ADS.isError` → `NotFoundRoute`, loading → `LoadingRoute`, fulfilled → `WithData`
- `WithData` renders `ProjectMembershipsList` and calls `useHandleHeader` to set the layout header title + right slot (the invite button)

```typescript
export function ProjectMembershipsRoute() {
  const projectId = useAppSelector(selectCurrentProjectId)
  const project = useAppSelector(selectProjectData)
  const membershipsData = useAppSelector(selectProjectMembershipsFromProjectId(projectId))

  if (!projectId) return <NotFoundRoute />
  if (ADS.isError(membershipsData) || ADS.isError(project)) return <NotFoundRoute />
  if (ADS.isFulfilled(membershipsData) && ADS.isFulfilled(project))
    return <WithData project={project.value} memberships={membershipsData.value} />
  return <LoadingRoute />
}
```

### 8.3 Sidebar Navigation

**File**: `components/sidebar/projects/NavProjectMemberships.tsx`

Follows the exact `NavDocuments.tsx` pattern:
- Uses `SidebarMenu > SidebarMenuItem > SidebarMenuButton` from `@caseai-connect/ui/shad/sidebar`
- Uses `UsersIcon` from `lucide-react`
- Uses `Link` from `react-router-dom`
- Uses `useAbility()` hook — returns `null` if `!isAdminInterface`
- Uses `buildProjectMembershipsPath` from `routes/helpers`
- Uses `useTranslation("common")` to get the localized label
- Checks active state via `useLocation().pathname`

```typescript
export function NavProjectMemberships({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) {
  const { t } = useTranslation("common")
  const { isAdminInterface } = useAbility()
  const isActive = useIsProjectMembershipsActive(projectId)
  if (!isAdminInterface) return null
  const path = buildProjectMembershipsPath({ organizationId, projectId })
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton isActive={isActive} asChild>
          <Link to={path} className="font-medium">
            <UsersIcon />
            <span>{t("members")}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
```

**File**: `components/sidebar/NavProjects.tsx` — in `ProjectItem`, renders `NavProjectMemberships` alongside the existing `NavDocuments`:

```typescript
<NavDocuments organizationId={project.organizationId} projectId={project.id} />
<NavProjectMemberships organizationId={project.organizationId} projectId={project.id} />
```

### 8.4 UI Components

#### `components/project-memberships/ProjectMembershipsList.tsx`

- Renders a list/table of project memberships
- Each row shows: user name (or "Pending" if null), user email, status badge (`sent` / `accepted`) using a custom `StatusBadge` component with Tailwind CSS classes, remove button (`Trash2Icon`)
- Remove button dispatches `removeProjectMembership` thunk
- Uses `useAppDispatch` and `useAppSelector` hooks
- Uses `useTranslation("projectMemberships")` for i18n keys

#### `components/project-memberships/InviteProjectMembersDialog.tsx`

Uses `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle` / `DialogDescription` from `@caseai-connect/ui/shad/dialog` (same pattern as `DeleteAgentDialog.tsx`):

- Controlled via `open` / `onOpenChange` state
- Form with a textarea for emails (comma or newline separated)
- Submit button dispatches `inviteProjectMembers` thunk
- On success: dialog closes using `.unwrap().then()` for handling success and resetting state (middleware handles list refresh + notification)
- Uses `useTranslation("projectMemberships", { keyPrefix: "invite" })`

### 8.5 Internationalization

**File**: `locales/en.json` — added new `projectMemberships` namespace:

```json
{
  "common": {
    "members": "Members",
    ...existing keys...
  },
  "projectMemberships": {
    "header": {
      "title": "Manage {{projectName}}'s members"
    },
    "list": {
      "name": "Name",
      "email": "Email",
      "status": "Status",
      "statusSent": "Invited",
      "statusAccepted": "Accepted",
      "pending": "Pending",
      "empty": {
        "title": "No members yet",
        "description": "Invite members to give them access to this project's agents."
      },
      "remove": "Remove member",
      "removing": "Removing..."
    },
    "invite": {
      "title": "Invite Members",
      "description": "Enter email addresses to invite members to this project.",
      "labelEmails": "Email addresses",
      "placeholderEmails": "Enter email addresses separated by commas or new lines",
      "submit": "Invite",
      "submitting": "Inviting..."
    }
  }
}
```

**File**: `locales/fr.json` — matching French translations.

### 8.6 Data Flow Summary

**Invite flow:**
```
User clicks "Invite Members" button (in route header right slot)
  → InviteProjectMembersDialog opens (Dialog from shadcn/ui)
  → User enters emails and clicks "Invite"
  → dispatch(inviteProjectMembers({ organizationId, projectId, emails }))
  → thunk calls invitations service (POST `/invitations`, `InvitationsRoutes.createForTarget`)
  → API creates pending `Invitation` rows and sends invitation emails (ticket per email)
  → Response returns `{ invitations: InvitationDto[] }`
  → Dialog closes via .unwrap().then()
  → Middleware: inviteProjectMembers.fulfilled triggers listProjectMemberships refresh
  → Middleware: notificationsActions.show({ title: "Members invited successfully", type: "success" })
  → Slice updates state for the projectId key
  → List re-renders with new memberships
```

**Acceptance flow:**
```
Invitee clicks invitation link in email
  → Browser navigates to: {Application Login URI}?invitation={ticket_id}&organization={org_id}
  → HomeRoute detects invitation + organization query params
  → Stores ticket_id in localStorage (key: "pendingInvitationTicketId")
  → Calls loginWithRedirect({ authorizationParams: { organization, invitation } })
  → Auth0 authenticates the user (signup or login)
  → Auth0 redirects back to the app
  → Auth middleware fires on setAuthenticated
  → consumePendingInvitation() reads and clears ticket_id from localStorage
  → dispatch(acceptInvitation({ ticketId }))
  → Axios POST /invitations/accept (only JwtAuthGuard, no UserGuard)
  → API reconciles placeholder auth0Id → real auth0Sub
  → API creates UserMembership (org member) if needed
  → API updates membership status to "accepted"
  → THEN dispatch(fetchMe())
  → /me finds the reconciled user (not a duplicate)
  → Normal app flow continues (navigate to organization dashboard)
```

---

## 9. Web Frontend — Invitation Acceptance

### 9.1 HomeRoute: Invitation Detection

**File**: `apps/web/src/routes/HomeRoute.tsx`

The `HomeRoute` is the application's entry point. It was extended to detect Auth0 invitation links:

1. On mount, checks for `invitation` and `organization` query parameters in the URL.
2. If present, stores the `invitation` (ticket_id) in `localStorage` using `storePendingInvitation()`.
3. Calls `loginWithRedirect` with `authorizationParams: { organization, invitation }` — this forwards the invitation ticket to Auth0 so it can associate the user with the organization.

**localStorage helpers** (exported from `HomeRoute.tsx`):

- `storePendingInvitation(ticketId: string)` — stores the ticket_id under key `"pendingInvitationTicketId"`.
- `consumePendingInvitation(): string | null` — reads and removes the ticket_id (one-time read).

### 9.2 Auth Middleware: Ordering `acceptInvitation` Before `fetchMe`

**File**: `apps/web/src/features/auth/auth.middleware.ts`

The auth middleware listens for `authActions.setAuthenticated` and now:

1. **First**, checks for a pending invitation via `consumePendingInvitation()`.
2. If found, dispatches `acceptInvitation({ ticketId })` **before** `fetchMe()`.
3. **Then** dispatches `fetchMe()`.

This ordering is critical: the `acceptInvitation` endpoint reconciles the placeholder user's `auth0Id` → real `auth0Sub`. If `fetchMe` ran first, `UserGuard.findOrCreate` would create a duplicate user.

### 9.3 Invitations Feature

A minimal new feature for invitation acceptance:

| File                                                                | Description                              |
|---------------------------------------------------------------------|------------------------------------------|
| `features/invitations/invitations.spi.ts`                           | SPI interface: `acceptInvitation(ticketId)` |
| `features/invitations/external/invitations.api.ts`                  | Axios implementation: `POST /invitations/accept` |
| `features/invitations/invitations.thunks.ts`                        | Redux thunk: `acceptInvitation`          |

Registered in `external/axios.services.ts` and `di/services.ts`.

---

## 10. File Summary

### API — `apps/api/src/domains/projects/memberships/`

| File                                | Action   | Description                                |
|-------------------------------------|----------|--------------------------------------------|
| `project-membership.entity.ts`      | **New**  | TypeORM entity                             |
| `project-membership.factory.ts`     | **New**  | Test factory (fishery)                     |
| `project-membership.policy.ts`      | **New**  | Dedicated policy extending `ProjectScopedPolicy<ProjectMembership>` |
| `project-membership.policy.spec.ts` | **New**  | Policy tests (canList, canCreate, canDelete) |
| `project-memberships.controller.ts` | **New**  | Dedicated controller for membership endpoints |
| `project-memberships.guard.ts`      | **New**  | Dedicated guard (fetches entity, enhances request, checks policy) |
| `project-memberships.service.ts`    | **New**  | Dedicated service for membership logic     |
| `project-memberships.service.spec.ts` | **New** | Service tests                             |
| `e2e-tests/auth.spec.ts`           | **New**  | Auth tests for all 3 membership routes     |
| `e2e-tests/list-project-memberships.spec.ts` | **New** | Functional e2e tests             |
| `e2e-tests/remove-project-membership.spec.ts` | **New** | Functional e2e tests            |

### API — `apps/api/src/domains/projects/` (modified)

| File                                | Action   | Description                                |
|-------------------------------------|----------|--------------------------------------------|
| `project.entity.ts`                 | Modify   | Add `@OneToMany` to `ProjectMembership` (import from `./memberships/`) |
| `projects.module.ts`                | Modify   | Register controller, service, and entity from `./memberships/` |

### API — `apps/api/src/domains/invitations/`

| File                                  | Action   | Description                                |
|---------------------------------------|----------|--------------------------------------------|
| `invitations.controller.ts`           | **New**  | Invitation acceptance endpoint (JwtAuthGuard only) |
| `invitations.module.ts`               | **New**  | NestJS module for invitations              |
| `e2e-tests/create-for-target.spec.ts` | **New**  | E2E: `InvitationsRoutes.createForTarget` (project target) |
| `e2e-tests/accept-invitation.spec.ts` | **New**  | E2E tests for invitation acceptance        |

### API — `apps/api/src/domains/auth/`

| File                                  | Action   | Description                                |
|---------------------------------------|----------|--------------------------------------------|
| `invitation-sender.interface.ts`      | **New**  | `InvitationSender` interface + `INVITATION_SENDER` token |
| `auth0-invitation-sender.service.ts`  | **New**  | Auth0 Management API implementation        |

### API Contracts — `packages/api-contracts/src/invitations/`

| File                   | Action   | Description                              |
|------------------------|----------|------------------------------------------|
| `invitations.dto.ts`   | **New**  | `AcceptInvitationRequestDto`, `AcceptInvitationResponseDto` |
| `invitations.routes.ts` | **New** | `InvitationsRoutes.acceptOne` route definition |

### API — Other modified files

| File                                | Action   | Description                                |
|-------------------------------------|----------|--------------------------------------------|
| `apps/api/src/request.interface.ts` | Modify   | Add `EndpointRequestWithProjectMembership` interface |
| `apps/api/src/app.module.ts`        | Modify   | Register `InvitationsModule`, `RequestLoggerMiddleware` |
| `apps/api/src/domains/users/user.entity.ts` | Modify | Add `@OneToMany` to `ProjectMembership` |
| `apps/api/src/common/test/test-transaction-manager.ts` | Modify | Add `ProjectMembership` to `TEST_ENTITIES` and repositories |
| `apps/api/src/common/test/test-database.ts` | Modify | Add `ProjectMembership` to `TEST_ENTITIES` and `clearTestDatabase` |
| `apps/api/src/common/middleware/request-logger.middleware.ts` | **New** | Request logging middleware (method, URL, body, response status/time) |

### API Contracts (`packages/api-contracts/src/projects/`)

| File               | Action | Description                              |
|--------------------|--------|------------------------------------------|
| `projects.dto.ts`  | Modify | Add project membership DTOs              |
| `projects.routes.ts` | Modify | Add 3 new route definitions            |

### Web (`apps/web/src/`)

| File                                                                | Action   | Description                                |
|---------------------------------------------------------------------|----------|--------------------------------------------|
| `features/project-memberships/project-memberships.models.ts`        | **New**  | Domain models                              |
| `features/project-memberships/project-memberships.spi.ts`           | **New**  | SPI interface (params as objects)           |
| `features/project-memberships/external/project-memberships.api.ts`  | **New**  | Axios implementation (`satisfies` SPI)     |
| `features/project-memberships/project-memberships.slice.ts`         | **New**  | Redux slice (keyed by projectId)           |
| `features/project-memberships/project-memberships.thunks.ts`        | **New**  | Redux thunks (list, invite, remove)        |
| `features/project-memberships/project-memberships.selectors.ts`     | **New**  | Redux selectors (returns `AsyncData`)      |
| `features/project-memberships/project-memberships.middleware.ts`    | **New**  | Listener middleware (refresh + notifications) |
| `components/project-memberships/ProjectMembershipsList.tsx`         | **New**  | Memberships list view                      |
| `components/project-memberships/InviteProjectMembersDialog.tsx`     | **New**  | Dialog (shadcn/ui) with email form         |
| `components/sidebar/projects/NavProjectMemberships.tsx`             | **New**  | Sidebar nav item (matches `NavDocuments`)  |
| `routes/admin/ProjectMembershipsRoute.tsx`                          | **New**  | Route component (matches `DocumentsRoute`) |
| `features/invitations/invitations.spi.ts`                           | **New**  | SPI interface for invitations              |
| `features/invitations/external/invitations.api.ts`                  | **New**  | Axios implementation for invitations       |
| `features/invitations/invitations.thunks.ts`                        | **New**  | Redux thunk for accepting invitations      |
| `routes/HomeRoute.tsx`                                              | Modify   | Detect invitation params, store in localStorage, redirect to Auth0 |
| `features/auth/auth.middleware.ts`                                  | Modify   | Call `acceptInvitation` before `fetchMe`   |
| `routes/Router.tsx`                                                 | Modify   | Add admin-only route child of PROJECT      |
| `routes/helpers.ts`                                                 | Modify   | Add `PROJECT_MEMBERSHIPS` + path builder   |
| `components/sidebar/NavProjects.tsx`                                | Modify   | Render `NavProjectMemberships` in `ProjectItem` |
| `external/axios.services.ts`                                        | Modify   | Register `projectMemberships` service      |
| `di/services.ts`                                                    | Modify   | Add `projectMemberships` to `Services` type |
| `store/index.ts`                                                    | Modify   | Register reducer + middleware              |
| `store/types.ts`                                                    | Modify   | Add `projectMemberships` to `RootState`    |
| `locales/en.json`                                                   | Modify   | Add `projectMemberships` + `common.members` keys |
| `locales/fr.json`                                                   | Modify   | Add matching French translations           |

### Database

| Action                        | Description                                        |
|-------------------------------|----------------------------------------------------|
| Generated migration           | `apps/api/src/migrations/1770803458597-create-project-membership.ts` |

---

## 11. Resolved Decisions

1. **File organization**: All project membership files live in `apps/api/src/domains/projects/memberships/` — a subfolder of the `projects` domain. This keeps the domain cohesive while avoiding file clutter.
2. **Policy architecture**: Project memberships have their own dedicated `ProjectMembershipPolicy` extending `ProjectScopedPolicy<ProjectMembership>`, with RESTful methods (`canList`, `canCreate`, `canDelete`). They do **not** extend `ProjectPolicy`.
3. **Guard architecture**: Context is resolved by `ResourceContextGuard` + resolvers (`organization`, `project`, `projectMembership`). `ProjectMembershipsGuard` performs policy evaluation only and does not fetch resources.
4. **Request type**: A new `EndpointRequestWithProjectMembership` interface extends `EndpointRequestWithProject` to carry the resolved `projectMembership` entity.
5. **Auth tests**: Project membership auth tests live in a dedicated `memberships/e2e-tests/auth.spec.ts`, separate from the projects' `e2e-tests/auth.spec.ts`.
6. **User creation for unknown emails**: Placeholder users use a unique `auth0Id` per user: `"00000000-0000-0000-0000-"` + a random 12-character suffix (via `randomUUID().slice(-12)`). This avoids unique constraint violations when inviting multiple new users.
7. **Bulk operations**: No bulk removal — out of scope for now.
8. **Pagination**: No pagination on the memberships list endpoint for now.
9. **Invitation delivery**: Auth0 handles invitation email delivery. The `invitationToken` on `ProjectMembership` stores the Auth0 `ticket_id`, not a self-generated UUID.
10. **Invitation acceptance flow**: Uses Auth0's built-in organization invitation mechanism. The web app detects `invitation` + `organization` query params from the Auth0 email link, stores the `ticket_id` in `localStorage`, and redirects to Auth0 for authentication. After auth, the web app calls `POST /invitations/accept` with the `ticket_id` to reconcile the placeholder user and mark the membership as accepted.
11. **Accept before /me ordering**: The `acceptInvitation` endpoint runs with `JwtAuthGuard` only (no `UserGuard`). The web app's auth middleware dispatches `acceptInvitation` **before** `fetchMe` to prevent `UserGuard.findOrCreate` from creating a duplicate user.
12. **Organization membership on acceptance**: When a user accepts a project invitation, they are automatically added as a `"member"` of the project's organization (via `UserMembership`), if not already a member.
13. **Placeholder user cleanup**: When removing a project membership whose user still has a placeholder `auth0Id` (never accepted), the placeholder user is also deleted to avoid orphaned records.

## 12. Open Questions / Future Considerations

1. **Invitation expiry**: Auth0 invitations expire after a configurable period. Should we handle expired invitations gracefully on the API side?
2. **Invitation revocation**: Should removing a project membership also revoke the Auth0 organization invitation?
3. **Multi-project invitations**: A user invited to multiple projects in the same organization only needs one Auth0 organization invitation. Currently, each project invitation sends a separate Auth0 invitation — should we deduplicate?
