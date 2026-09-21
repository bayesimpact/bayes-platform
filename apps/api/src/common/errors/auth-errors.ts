export const AUTH_ERRORS = {
  NO_ACCESS_TOKEN: "No access token provided",
  NO_ORGANIZATION_ID: "Organization ID is required",
  NO_PROJECT_ID: "Project ID is required",
  NOT_MEMBER_OF_ORG: "Not a member of organization",
  SUB_NOT_FOUND: "Sub not found in request",
  USER_NOT_FOUND: "Could not ensure user exists",
  SERVICE_USERS_CANNOT_AUTHENTICATE: "Service users cannot authenticate through Auth0",

  UNAUTHORIZED_RESOURCE: "You are not authorized to access this resource",
} as const
