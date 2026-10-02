/** A fixture is the resolved value of a service call, or a function of the call arguments. */
export type Fixture = unknown

export type Fixtures = Record<string, Fixture>

export type Scenario = {
  description: string
  /** Page the probe opens when no --path is given. */
  path: string
  /** Fixtures keyed by "service.method", for example "agents.getAll". */
  buildFixtures: (params: URLSearchParams) => Fixtures
}
