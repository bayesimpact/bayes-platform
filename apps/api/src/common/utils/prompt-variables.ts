import {
  extractPromptVariables,
  findMissingPromptVariables,
  hasPromptVariableValue,
  PROMPT_VARIABLE_PLACEHOLDER,
} from "@caseai-connect/api-contracts"
import { BadRequestException } from "@nestjs/common"

/**
 * The {{variables}} an agent declares in its instructions.
 *
 * The parse (which variables a prompt declares) lives in the shared
 * `@caseai-connect/api-contracts` package, so the API and the studio UI agree on
 * it. This module keeps the session-side resolution: substituting the declared
 * variables with their resolved values and refusing a session or a turn that is
 * missing one.
 */

export { extractPromptVariables, findMissingPromptVariables }

/**
 * The values a session stores for its declared variables: the caller's values
 * over the settings defaults — a blank caller value is missing, so the
 * default is what gets stored — restricted to the declared names (values for
 * undeclared variables are dropped). Null when the instructions declare
 * nothing.
 */
export function pickDeclaredPromptVariables(
  declared: string[],
  values?: Record<string, string> | null,
  defaults?: Record<string, string> | null,
): Record<string, string> | null {
  if (declared.length === 0) return null
  const stored: Record<string, string> = {}
  for (const name of declared) {
    const callerValue = values?.[name]
    const value = hasPromptVariableValue(callerValue) ? callerValue : defaults?.[name]
    if (hasPromptVariableValue(value)) stored[name] = value
  }
  return stored
}

/**
 * Substitutes the `{{variables}}` of the instructions with their resolved
 * values. An unresolved placeholder becomes an empty string, so no raw
 * placeholder ever reaches the model.
 */
export function substitutePromptVariables(
  instructions: string,
  resolved?: Record<string, string> | null,
): string {
  return instructions.replace(
    PROMPT_VARIABLE_PLACEHOLDER,
    (_, name: string) => resolved?.[name] ?? "",
  )
}

/**
 * The variables a session starts with: every variable the settings'
 * instructions declare must have a value — the caller's over the settings'
 * defaults — or the session is refused (400 MISSING_PROMPT_VARIABLES).
 * Returns the values to store on the session, `null` when the instructions
 * declare nothing.
 */
export function resolveSessionStartPromptVariables(
  agentSettings: { instructions: string; variables?: Record<string, string> | null },
  callerVariables?: Record<string, string> | null,
): Record<string, string> | null {
  const declared = extractPromptVariables(agentSettings.instructions)
  const missing = findMissingPromptVariables(declared, callerVariables, agentSettings.variables)
  if (missing.length > 0) throw missingPromptVariablesException(missing)
  return pickDeclaredPromptVariables(declared, callerVariables, agentSettings.variables)
}

/**
 * The prompt-variable part of a session: the values it stores (the session
 * row, or the proxy of a public session) and, for public sessions, the defaults
 * it re-reads at turn time.
 */
export type PromptVariableSession = {
  /** Values resolved at session creation (see {@link pickDeclaredPromptVariables}). */
  variables?: Record<string, string> | null
  /** Defaults re-read at turn time: the current published settings of a public session. */
  variableDefaults?: Record<string, string> | null
}

/**
 * A turn whose agent declares variables the session cannot resolve. The stream
 * surfaces it as an error event carrying this message.
 */
export class MissingPromptVariablesError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing prompt variables: ${missing.join(", ")}`)
    this.name = "MissingPromptVariablesError"
  }
}

/**
 * The agent settings to build the next prompt from: the instructions with
 * their declared {{variables}} substituted.
 *
 * A declared variable resolves to the session's stored value when it has one,
 * else to the session's defaults — which is what forces a value into a variable
 * the agent declared after the session was created. A variable with neither
 * refuses the turn with a {@link MissingPromptVariablesError}.
 */
export function resolveSessionPromptVariables<T extends { instructions: string }>(
  agentSettings: T,
  session: PromptVariableSession,
): T {
  const declared = extractPromptVariables(agentSettings.instructions)
  if (declared.length === 0) return agentSettings
  const defaults = session.variableDefaults ?? null
  const missing = findMissingPromptVariables(declared, session.variables, defaults)
  if (missing.length > 0) throw new MissingPromptVariablesError(missing)
  const resolved: Record<string, string> = { ...defaults }
  for (const [name, value] of Object.entries(session.variables ?? {})) resolved[name] = value
  return {
    ...agentSettings,
    instructions: substitutePromptVariables(agentSettings.instructions, resolved),
  }
}

/**
 * The 400 of a session creation refused because the agent's instructions
 * declare variables the caller could not supply: no caller value and no
 * settings default for at least one of them. `code` and `missing` make the
 * error machine-readable.
 */
export function missingPromptVariablesException(missing: string[]): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    message: `Missing prompt variables: ${missing.join(", ")}`,
    error: "Bad Request",
    code: "MISSING_PROMPT_VARIABLES",
    missing,
  })
}
