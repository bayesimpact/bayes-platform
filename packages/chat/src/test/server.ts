import { setupServer } from "msw/node"

/** The mocked API of the package's specs: `setup.ts` gives it a fresh world before each spec. */
export const server = setupServer()
