import { setupServer } from "msw/node"

/** The mocked API of the component tests: `setup.ts` gives it a fresh world before each test. */
export const server = setupServer()
