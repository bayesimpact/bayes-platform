/**
 * The import boundaries of the app (ADR 0031, section 2.4). `npm run check:boundaries` runs it,
 * with knip. Both only see imports: a copied file or a CSS import can still bypass them.
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "No import cycle.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-other-app",
      severity: "error",
      comment:
        "The app imports nothing from another app or from a package another app owns. Its " +
        "workspace dependencies are @bayes-platform/eval-contracts and the packages no app " +
        "owns: @bayes-platform/api-client, @bayes-platform/mcp-app-host and " +
        "@bayes-platform/sign-in (ADR 0031, section 2.4).",
      from: { path: "^src/" },
      to: {
        path: [
          // Another app: a sibling of apps/eval.
          "^\\.\\./(?!\\.\\./|eval/)[^/]+/",
          "^\\.\\./\\.\\./packages/(?!(api-client|eval-contracts|mcp-app-host|sign-in)/)",
          "node_modules/@bayes-platform/(?!(api-client|eval-contracts|mcp-app-host|sign-in)(/|$))",
          "node_modules/@repo/",
        ],
      },
    },
    {
      name: "routes-import-feature-entries",
      severity: "error",
      comment: "A route imports a feature through its index.ts only.",
      from: { path: "^src/routes/" },
      to: { path: "^src/features/[^/]+/(?!index\\.ts$)" },
    },
    {
      name: "features-import-other-features-through-their-entry",
      severity: "error",
      comment:
        "A feature imports another feature through its index.ts only, and preferably not at all: " +
        "shared code moves to lib/ or components/shared/.",
      from: { path: "^src/features/([^/]+)/" },
      to: { path: "^src/features/(?!$1/)[^/]+/(?!index\\.ts$)" },
    },
    {
      name: "shared-code-imports-no-feature-or-route",
      severity: "error",
      comment: "components/, hooks/ and lib/ import neither features/ nor routes/.",
      from: { path: "^src/(components|hooks|lib)/" },
      to: { path: "^src/(features|routes)/" },
    },
    {
      name: "only-lib-auth-imports-sign-in",
      severity: "error",
      comment:
        "lib/auth/session.ts is the app's sign-in: the rest of the app reads it, never " +
        "@bayes-platform/sign-in or the OIDC client that package wraps.",
      from: { path: "^src/", pathNot: "^src/lib/auth/" },
      to: {
        path: ["node_modules/oidc-client-ts/", "(node_modules/@bayes-platform|packages)/sign-in/"],
      },
    },
    {
      name: "only-lib-api-client-imports-api-client",
      severity: "error",
      comment:
        "lib/api-client.ts is the app's API client, on the app's session: the rest of the app " +
        "reads it, never @bayes-platform/api-client.",
      from: { path: "^src/", pathNot: "^src/lib/api-client\\.ts$" },
      to: { path: "(node_modules/@bayes-platform|packages)/api-client/" },
    },
    {
      name: "test-code-stays-in-tests",
      severity: "error",
      comment:
        "src/test/ (handlers, factories) and src/stories/ are for the tests and the stories " +
        "only: no app code imports them.",
      from: {
        path: "^src/",
        pathNot: ["^src/(test|stories)/", "\\.spec\\.tsx?$", "\\.stories\\.tsx$"],
      },
      to: { path: "^src/(test|stories)/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.app.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "types", "default"],
      extensions: [".ts", ".tsx", ".js"],
    },
  },
}
