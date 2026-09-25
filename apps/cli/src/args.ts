export const INSTALL_USAGE = `bayes apps install <slug> [--frontend <origin>]

Open the Bayes install page and print the client id and client secret once.

  --frontend   Web app origin, for example https://connect.localhost:5173.
               Defaults to BAYES_FRONTEND_URL.
`

export type ParsedArgs =
  | { kind: "help" }
  | { kind: "install"; slug: string; frontendOrigin: string }
  | { kind: "error"; message: string }

export function parseInstallArgs(argv: readonly string[], env: NodeJS.ProcessEnv): ParsedArgs {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") return { kind: "help" }
  }

  if (argv[0] !== "apps" || argv[1] !== "install") {
    return { kind: "error", message: `Unknown command.\n\n${INSTALL_USAGE}` }
  }

  const rest = argv.slice(2)
  if (rest.includes("--help") || rest.includes("-h")) return { kind: "help" }

  let slug: string | undefined
  let frontendOrigin = env.BAYES_FRONTEND_URL
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]
    if (arg === undefined) continue
    if (arg === "--frontend") {
      const value = rest[index + 1]
      if (!value || value.startsWith("--")) {
        return { kind: "error", message: `Missing value for --frontend.\n\n${INSTALL_USAGE}` }
      }
      frontendOrigin = value
      index += 1
      continue
    }
    if (arg.startsWith("--")) {
      return { kind: "error", message: `Unknown option ${arg}.\n\n${INSTALL_USAGE}` }
    }
    if (slug) return { kind: "error", message: `Unexpected argument ${arg}.\n\n${INSTALL_USAGE}` }
    slug = arg
  }

  if (!slug) return { kind: "error", message: `Missing app slug.\n\n${INSTALL_USAGE}` }
  if (!frontendOrigin) {
    return {
      kind: "error",
      message: `Set --frontend or BAYES_FRONTEND_URL.\n\n${INSTALL_USAGE}`,
    }
  }

  return { kind: "install", slug, frontendOrigin }
}
