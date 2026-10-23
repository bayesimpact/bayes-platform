import { BadRequestException } from "@nestjs/common"
import {
  extractPromptVariables,
  findMissingPromptVariables,
  MissingPromptVariablesError,
  missingPromptVariablesException,
  pickDeclaredPromptVariables,
  resolveSessionPromptVariables,
  resolveSessionStartPromptVariables,
  substitutePromptVariables,
} from "./prompt-variables"

describe("extractPromptVariables", () => {
  it("returns the declared names in order of first appearance, without duplicates", () => {
    const instructions =
      "Apply {{inclusion_criteria}} to {{title}}. Ignore {{inclusion_criteria}} again."
    expect(extractPromptVariables(instructions)).toEqual(["inclusion_criteria", "title"])
  })

  it("accepts letters, digits, underscores and dashes", () => {
    expect(extractPromptVariables("{{a_b-c9}} {{x}}")).toEqual(["a_b-c9", "x"])
  })

  it("declares nothing for an instruction without placeholders", () => {
    expect(extractPromptVariables("You are a helpful assistant.")).toEqual([])
  })

  it("ignores single braces and unclosed placeholders", () => {
    expect(extractPromptVariables("{{not closed} {single} {{ spaced }} {{ok}}")).toEqual(["ok"])
  })
})

describe("findMissingPromptVariables", () => {
  it("lists the declared variables with no value and no default", () => {
    const declared = ["a", "b", "c"]
    expect(findMissingPromptVariables(declared, { b: "B" }, { a: "A" })).toEqual(["c"])
  })

  it("treats a blank string as missing", () => {
    expect(findMissingPromptVariables(["a"], { a: "  " })).toEqual(["a"])
    expect(findMissingPromptVariables(["a"], null, { a: "" })).toEqual(["a"])
  })

  it("finds nothing missing when every declared variable is covered", () => {
    expect(findMissingPromptVariables(["a", "b"], { a: "A" }, { b: "B" })).toEqual([])
    expect(findMissingPromptVariables([], { extra: "x" })).toEqual([])
  })
})

describe("pickDeclaredPromptVariables", () => {
  it("stores the caller's values over the defaults, restricted to the declared names", () => {
    const declared = ["a", "b", "c"]
    expect(
      pickDeclaredPromptVariables(
        declared,
        { b: "caller", c: "caller" },
        { a: "default", b: "default" },
      ),
    ).toEqual({ a: "default", b: "caller", c: "caller" })
  })

  it("stores the default when the caller's value is blank", () => {
    expect(pickDeclaredPromptVariables(["a"], { a: "  " }, { a: "default" })).toEqual({
      a: "default",
    })
  })

  it("drops values for undeclared variables", () => {
    expect(pickDeclaredPromptVariables(["a"], { a: "A", extra: "x" })).toEqual({ a: "A" })
  })

  it("is null when the instructions declare nothing, even if the caller sent values", () => {
    expect(pickDeclaredPromptVariables([], { a: "A" })).toBeNull()
  })
})

describe("substitutePromptVariables", () => {
  it("substitutes every placeholder with its resolved value", () => {
    const instructions = "Criteria: {{inclusion_criteria}}. Title: {{title}}."
    expect(
      substitutePromptVariables(instructions, { inclusion_criteria: "REC only", title: "T1" }),
    ).toBe("Criteria: REC only. Title: T1.")
  })

  it("replaces an unresolved placeholder with an empty string", () => {
    expect(substitutePromptVariables("{{a}} and {{b}}", { a: "A" })).toBe("A and ")
  })

  it("leaves the instructions untouched when nothing is resolved", () => {
    expect(substitutePromptVariables("no placeholders", { a: "A" })).toBe("no placeholders")
  })
})

describe("resolveSessionPromptVariables", () => {
  const settings = { instructions: "Apply {{criteria}} to {{scope}}", model: "gpt" }

  it("returns the settings untouched when the instructions declare nothing", () => {
    expect(resolveSessionPromptVariables({ instructions: "plain" }, {})).toEqual({
      instructions: "plain",
    })
  })

  it("substitutes the session's stored values, which win over the defaults", () => {
    const resolved = resolveSessionPromptVariables(settings, {
      variables: { criteria: "C", scope: "S" },
    })
    expect(resolved.instructions).toBe("Apply C to S")
    const withDefaults = resolveSessionPromptVariables(settings, {
      variables: { criteria: "C" },
      variableDefaults: { criteria: "D", scope: "S" },
    })
    expect(withDefaults.instructions).toBe("Apply C to S")
  })

  it("forces a value from the defaults into a variable declared after the session was created", () => {
    const resolved = resolveSessionPromptVariables(
      { instructions: "Apply {{criteria}} to {{scope}}" },
      { variables: { criteria: "C" }, variableDefaults: { scope: "new-scope" } },
    )
    expect(resolved.instructions).toBe("Apply C to new-scope")
  })

  it("refuses the turn when a declared variable has neither value nor default", () => {
    expect(() => resolveSessionPromptVariables(settings, { variables: { criteria: "C" } })).toThrow(
      new MissingPromptVariablesError(["scope"]),
    )
    expect(() => resolveSessionPromptVariables(settings, {})).toThrow(
      "Missing prompt variables: criteria, scope",
    )
  })

  it("keeps the rest of the settings", () => {
    const resolved = resolveSessionPromptVariables(settings, {
      variables: { criteria: "C", scope: "S" },
    })
    expect(resolved.model).toBe("gpt")
  })
})

describe("resolveSessionStartPromptVariables", () => {
  const settings = {
    instructions: "Apply {{criteria}} to {{scope}}",
    variables: { criteria: "default-c", scope: "default-s" },
  }

  const thrownBy = (fn: () => unknown) => {
    try {
      fn()
      return null
    } catch (error) {
      return error
    }
  }

  it("returns the caller's values over the settings' defaults, restricted to the declared names", () => {
    expect(
      resolveSessionStartPromptVariables(settings, { criteria: "C", scope: "S", extra: "x" }),
    ).toEqual({ criteria: "C", scope: "S" })
  })

  it("falls back to the settings' defaults for the variables the caller left blank", () => {
    expect(resolveSessionStartPromptVariables(settings, { scope: "  " })).toEqual({
      criteria: "default-c",
      scope: "default-s",
    })
  })

  it("returns null when the instructions declare nothing, even if the caller sent values", () => {
    expect(resolveSessionStartPromptVariables({ instructions: "plain" }, { a: "A" })).toBeNull()
  })

  it("refuses the session with the 400 when a declared variable has neither value nor default", () => {
    const noScopeDefault = { ...settings, variables: { criteria: "default-c" } }
    const thrown = thrownBy(() => resolveSessionStartPromptVariables(noScopeDefault, undefined))
    expect(thrown).toBeInstanceOf(BadRequestException)
    expect((thrown as BadRequestException).getResponse()).toMatchObject({
      statusCode: 400,
      code: "MISSING_PROMPT_VARIABLES",
      missing: ["scope"],
    })
  })
})

describe("missingPromptVariablesException", () => {
  it("is a 400 with the machine-readable code and the missing list", () => {
    const exception = missingPromptVariablesException(["a", "b"])
    expect(exception.getStatus()).toBe(400)
    expect(exception.getResponse()).toEqual({
      statusCode: 400,
      message: "Missing prompt variables: a, b",
      error: "Bad Request",
      code: "MISSING_PROMPT_VARIABLES",
      missing: ["a", "b"],
    })
  })
})
