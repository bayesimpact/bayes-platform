// Replaces @/external/axios.services (see vite.config.ts). Every service call resolves
// to the scenario fixture after a delay, so data races can be replayed on demand.
//
// URL parameters:
//   scenario=<key>                    fixtures to serve (see scenarios/index.ts)
//   min=20&max=400                    random delay range in ms for every call
//   delays=agentSettings.getAll:1500  fixed delay for some calls (comma separated)
//   fail=agentSettings.getAll         calls that reject (comma separated)
import { harnessState } from "./harness-state"
import { DEFAULT_SCENARIO, scenarios } from "./scenarios"

const params = new URLSearchParams(window.location.search)

const fixedDelays = new Map(
  (params.get("delays") ?? "")
    .split(",")
    .filter(Boolean)
    .map((entry) => {
      const [key = "", ms = "0"] = entry.split(":")
      return [key, Number(ms)] as const
    }),
)
const failingCalls = new Set((params.get("fail") ?? "").split(",").filter(Boolean))
const minDelay = Number(params.get("min") ?? 20)
const maxDelay = Number(params.get("max") ?? 400)

const scenarioKey = params.get("scenario") ?? DEFAULT_SCENARIO
const scenario = scenarios[scenarioKey]
if (!scenario) throw new Error(`Unknown harness scenario "${scenarioKey}"`)
const fixtures = scenario.buildFixtures(params)
harnessState.scenario = scenarioKey
harnessState.scenarioPath = scenario.path

function delayFor(key: string) {
  return fixedDelays.get(key) ?? minDelay + Math.random() * (maxDelay - minDelay)
}

function resolveFixture(key: string, args: unknown[]) {
  if (!(key in fixtures)) {
    harnessState.missingFixtures.add(key)
    return key.endsWith("getAll") || key.endsWith("list") ? [] : undefined
  }
  const fixture = fixtures[key]
  return typeof fixture === "function" ? fixture(...args) : fixture
}

function callService(key: string, args: unknown[]) {
  const ms = delayFor(key)
  harnessState.calls.push(`${performance.now().toFixed(0)}ms call ${key} (+${ms.toFixed(0)}ms)`)
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      harnessState.calls.push(`${performance.now().toFixed(0)}ms done ${key}`)
      if (failingCalls.has(key)) reject(new Error(`Harness: ${key} failed`))
      else resolve(resolveFixture(key, args))
    }, ms),
  )
}

const serviceProxy = (serviceName: string) =>
  new Proxy(
    {},
    {
      get: (_target, methodName) => {
        // Keeps the proxy from looking like a promise when it is awaited.
        if (typeof methodName !== "string" || methodName === "then") return undefined
        return (...args: unknown[]) => callService(`${serviceName}.${methodName}`, args)
      },
    },
  )

export const services = new Proxy(
  {},
  {
    get: (_target, serviceName) =>
      typeof serviceName === "string" ? serviceProxy(serviceName) : undefined,
  },
)
