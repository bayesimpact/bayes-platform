// dependency-cruiser config for apps/api.
//
// Encodes the highest-value invariants from docs/adr/0007-nestjs-module-topology.md.
// Current violations are captured as a baseline in
// .dependency-cruiser-known-violations.json and ignored via --ignore-known in
// the npm `check:deps` script. Driving the baseline to zero is the migration
// goal — see ADR 0007 §5.
//
// Regenerate the baseline with `npm run check:deps:baseline`.
//
// The broader 5-layer topology from ADR §2.1 is intentionally NOT encoded here
// yet; current folder layout mixes infra and domain files under src/domains/,
// so a path-regex-based layer rule produces too many false positives to be
// useful. Revisit once module folders are reshaped (ADR §5 step 10+).

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Circular dependencies are the root cause of the forwardRef sprawl " +
        "documented in ADR 0007 §1. Break the cycle or restructure the " +
        "offending modules. Baseline captures the 4 known cycles; any new " +
        "cycle fails CI.",
      from: {},
      to: {
        circular: true,
      },
    },

    {
      name: "no-cross-domain-entity-import",
      severity: "error",
      comment:
        "Importing another domain's *.entity.ts from outside that domain is " +
        "the main layering violation listed in ADR 0007 §1. Call the owning " +
        "module's service instead — optionally via an EntityManager-accepting " +
        "method (see ADR 0007 §2.3). Allowed exceptions: " +
        "  - common/all-entities.ts (TypeORM entity registry) " +
        "  - *.factory.ts, *.spec.ts (test fixtures) " +
        "  - src/migrations/, src/scripts/ (one-shot utilities) " +
        "  - another *.entity.ts (TypeORM bidirectional relations — see " +
        "    `no-circular` for the cycle check).",
      from: {
        path: "^src/domains/([^/]+)/",
        pathNot: [
          "^src/common/all-entities\\.ts$",
          "\\.factory\\.ts$",
          "\\.spec\\.ts$",
          "^src/migrations/",
          "^src/scripts/",
          "\\.entity\\.ts$",
        ],
      },
      to: {
        path: "^src/domains/(?!$1)[^/]+/.*\\.entity\\.ts$",
      },
    },

    {
      name: "no-cross-domain-service-reach",
      severity: "warn",
      comment:
        "Reaching into another domain's *.service.ts or repository wiring " +
        "suggests a missing service boundary. Warnings only for now — this " +
        "surfaces candidates for the EntityManager-accepting service methods " +
        "described in ADR 0007 §2.3.",
      from: {
        path: "^src/domains/([^/]+)/",
        pathNot: ["\\.spec\\.ts$", "\\.factory\\.ts$", "^src/migrations/", "^src/scripts/"],
      },
      to: {
        path: "^src/domains/(?!$1)[^/]+/.*\\.service\\.ts$",
      },
    },

    {
      name: "no-feature-imports-cross-domain",
      severity: "error",
      comment:
        "Cross-domain read-model modules (me, analytics, invitations) sit " +
        "*above* feature domains in the topology (ADR 0007 §2.1). Feature " +
        "domains must never import them — the dependency only flows the other " +
        "way.",
      from: {
        path: [
          "^src/domains/organizations/",
          "^src/domains/projects/",
          "^src/domains/agents/(?!shared/memberships/)",
          "^src/domains/documents/",
          "^src/domains/evaluations/",
          "^src/domains/mcp-servers/",
          "^src/domains/activities/",
          "^src/domains/feature-flags/",
          "^src/domains/users/",
          "^src/domains/auth/",
        ],
        pathNot: ["\\.spec\\.ts$", "\\.factory\\.ts$"],
      },
      to: {
        path: [
          "^src/domains/me/",
          "^src/domains/analytics/",
          "^src/domains/backoffice/",
          "^src/domains/agents/shared/memberships/",
        ],
      },
    },

    {
      name: "no-workers-pulling-cross-domain",
      severity: "error",
      comment:
        "workers-app.module.ts and its transitive closure must not reach " +
        "cross-domain read-models (me, analytics, invitations). Importing them " +
        "into a worker is the 'importing DocumentsModule pulls half the app' " +
        "pathology described in ADR 0007 §1.",
      from: {
        path: [
          "^src/workers-app\\.module\\.ts$",
          "^src/domains/documents/embeddings/document-embeddings-workers\\.module\\.ts$",
          "^src/domains/evaluations/extraction/runs/evaluation-extraction-run-workers\\.module\\.ts$",
        ],
      },
      to: {
        path: [
          "^src/domains/me/",
          "^src/domains/analytics/",
          "^src/domains/backoffice/",
          "^src/domains/agents/shared/memberships/",
        ],
      },
    },
  ],

  options: {
    doNotFollow: {
      path: ["node_modules"],
    },
    exclude: {
      path: [
        "node_modules",
        "dist",
        "^src/migrations/",
        "\\.spec\\.ts$",
        "^\\.\\./\\.\\./\\.\\./packages/",
      ],
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      extensions: [".ts", ".js"],
    },
  },
}
