/**
 * The import boundaries of the Desk (ADR 0031, section 2.4). `npm run check:boundaries` runs it,
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
        "The Desk imports nothing from another app or from a package another app owns: its only " +
        "workspace dependency is @caseai-connect/desk-contracts.",
      from: { path: "^src/" },
      to: {
        path: [
          // Another app: a sibling of apps/desk.
          "^\\.\\./(?!\\.\\./|desk/)[^/]+/",
          "^\\.\\./\\.\\./packages/(?!desk-contracts/)",
          "node_modules/@caseai-connect/(?!desk-contracts)",
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
      name: "only-lib-auth-imports-oidc-client-ts",
      severity: "error",
      comment: "The sign-in module, lib/auth/, is the only one that knows the OIDC client.",
      from: { path: "^src/", pathNot: "^src/lib/auth/" },
      to: { path: "node_modules/oidc-client-ts/" },
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
