import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { tool } from "@ai-sdk/provider-utils"
import type { ToolSet } from "ai"
import { v4 } from "uuid"
import { z } from "zod"
import type { LLMChatMessage, LLMProvider } from "@/common/interfaces/llm-provider.interface"
import { castToolInputParameters, zNullableType } from "@/common/zod-helper"
import {
  expectIncludes,
  expectIncludesAtLeastOne,
  includesInsensitive,
} from "@/external/llm/providers/spec-tools"

// biome-ignore lint/complexity/noStaticOnlyClass: helper
export class ProviderSpecs {
  private static systemPrompt =
    "You're a chat bot named Elvis. Your goal is to answer to the user with the knowledge you have"
  private static temperature = 0

  private static getMetadata() {
    return {
      agentId: "agentId",
      agentSessionId: "agentSessionId",
      currentTurn: 0,
      organizationId: "organizationId",
      projectId: "projectId",
      tags: ["**TEST**"],
      traceId: v4(),
    }
  }

  static async testGenerateText({ provider, model }: { provider: LLMProvider; model: string }) {
    const metadata = ProviderSpecs.getMetadata()
    const prompt = "What's your name?"
    const config = {
      model,
      temperature: ProviderSpecs.temperature,
      systemPrompt: ProviderSpecs.systemPrompt,
    }
    const result = await provider.generateText({ prompt, config, metadata })
    expect(result).toBeDefined()
    expectIncludes(result, "Elvis")
  }
  static async testGenerateObject({ provider, model }: { provider: LLMProvider; model: string }) {
    const metadata = ProviderSpecs.getMetadata()
    const prompt = "Can I use aspirin if I am bleeding?"
    const schema = z.object({
      yesOrNo: z.string().describe("'yes' or 'no'"),
      justification: z.string().describe("Explain why in 2 or 3 sentences"),
    })
    const config = {
      model,
      temperature: ProviderSpecs.temperature,
      systemPrompt: ProviderSpecs.systemPrompt,
    }
    const result = await provider.generateObject({ schema, prompt, config, metadata })
    expect(result).toBeDefined()
    expect(() => schema.parse(result)).not.toThrow()
    const parsed = schema.parse(result)
    expectIncludes(parsed.yesOrNo, "no")
  }
  static async testStreamChatResponse({
    provider,
    model,
  }: {
    provider: LLMProvider
    model: string
  }) {
    const metadata = ProviderSpecs.getMetadata()
    const messages: LLMChatMessage[] = [{ role: "user", content: "What can you do for me?" }]
    const config = {
      model,
      temperature: ProviderSpecs.temperature,
      systemPrompt: ProviderSpecs.systemPrompt,
    }
    const stream = provider.streamChatResponse({ messages, config, metadata })
    const results = await ProviderSpecs.streamToStringArray(stream)
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)
    expectIncludesAtLeastOne(results.join(""), ["answer", "ask"])
  }
  static async testStreamChatResponseWithTools({
    provider,
    model,
    advancedExpectation,
  }: {
    provider: LLMProvider
    model: string
    advancedExpectation: boolean
  }) {
    const prompt = `##Instructions:
    Your main task is to help the user fill out the form by asking questions and providing guidance.
    Ask one question at a time to fill out the form.
    Here are the form fields to fill:

        happy: Is happy?
        hourOfSleep: How many sleep hours per day?
        weight: weight in kilogrammes (rounded .5)?

    ##Tools:
    You should use "fillForm" tool to fill out the form, each time you got a response that can be used to fill the form.
    Call "fillForm" each times you have a new information or an updated one: pass undefined for fields that are not filled yet.
    You can also update previously filled information if the user changes their answer.
    After getting response from the tool "fillForm", continue asking the user until the status is "completed".
    If the status is "completed" just send a message to the user that indicates that the form has been completed.
    Response language: Always answer in English.`
    const inputSchema = z.object({
      happy: zNullableType(z.boolean(), "Is happy?"),
      hourOfSleep: zNullableType(z.int(), "How many sleep hours per day?"),
      weight: zNullableType(z.number(), "weight in kilogrammes (rounded .5)?"),
    })
    let outputForm: Record<string, boolean | string | number | undefined> = {}
    let status: string = "NOT_STARTED"
    const fillFormTool = tool({
      description: "Fill out a form. Get the values from user's answers.",
      inputSchema,
      outputSchema: z.object({
        status: z
          .enum(["completed", "in_progress"])
          .describe("Whether the form is completed or not"),
        formState: inputSchema.describe(
          "The current state of the form, with values filled by the user",
        ),
      }),
      execute: async (input, _options) => {
        const typedInput = castToolInputParameters(input)
        if (typeof typedInput.happy === "string") {
          if (typedInput.happy.toLowerCase() === "null") input.happy = undefined
          else if (
            typedInput.happy.toLowerCase() === "true" ||
            typedInput.happy.toLowerCase() === "yes"
          )
            input.happy = true
        }
        const hours =
          typeof typedInput.hourOfSleep === "number" ? typedInput.hourOfSleep : undefined
        const weight = typeof typedInput.weight === "number" ? typedInput.weight : undefined
        status = typedInput.happy !== undefined && hours && weight ? "completed" : "in_progress"

        outputForm = castToolInputParameters(input)
        return {
          status,
          formState: input,
        }
      },
    })
    const config = {
      model,
      temperature: ProviderSpecs.temperature,
      systemPrompt: prompt,
      tools: { fillForm: fillFormTool } as ToolSet,
    }
    const chatMessages: LLMChatMessage[] = [{ role: "user", content: "Hello" }]
    const metadata = ProviderSpecs.getMetadata()
    const traceId = metadata.traceId
    metadata.currentTurn = chatMessages.filter((message) => message.role === "user").length
    let stream = provider.streamChatResponse({ messages: chatMessages, config, metadata })
    let results = await ProviderSpecs.streamToStringArray(stream)
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)
    if (advancedExpectation) {
      expect(status).not.toEqual("completed")
      expect(!outputForm.happy).toBeTruthy()
      expect(!outputForm.hourOfSleep).toBeTruthy()
      expect(!outputForm.weight).toBeTruthy()
    }

    chatMessages.push({ role: "assistant", content: results.join("") })
    chatMessages.push({ role: "user", content: "I'm happy" })
    const metadata2 = ProviderSpecs.getMetadata()
    metadata2.currentTurn = chatMessages.filter((message) => message.role === "user").length
    metadata2.traceId = traceId
    stream = provider.streamChatResponse({ messages: chatMessages, config, metadata: metadata2 })
    results = await ProviderSpecs.streamToStringArray(stream)
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)
    if (advancedExpectation) {
      expect(status).not.toEqual("completed")
      expect(outputForm.happy).toBeTruthy()
      expect(!outputForm.hourOfSleep).toBeTruthy()
      expect(!outputForm.weight).toBeTruthy()
    }

    chatMessages.push({ role: "assistant", content: results.join("") })
    chatMessages.push({ role: "user", content: "I sleep about 7 hours a night" })
    const metadata3 = ProviderSpecs.getMetadata()
    metadata3.currentTurn = chatMessages.filter((message) => message.role === "user").length
    metadata3.traceId = traceId
    stream = provider.streamChatResponse({ messages: chatMessages, config, metadata: metadata3 })
    results = await ProviderSpecs.streamToStringArray(stream)
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)
    if (advancedExpectation) {
      expect(status).not.toEqual("completed")
      expect(outputForm.happy).toEqual(true)
      expect(outputForm.hourOfSleep).toEqual(7)
      expect(!outputForm.weight).toBeTruthy()
    }

    chatMessages.push({ role: "assistant", content: results.join("") })
    chatMessages.push({ role: "user", content: "I do not smoke" })
    const metadata4 = ProviderSpecs.getMetadata()
    metadata4.currentTurn = chatMessages.filter((message) => message.role === "user").length
    metadata4.traceId = traceId
    stream = provider.streamChatResponse({ messages: chatMessages, config, metadata: metadata4 })
    results = await ProviderSpecs.streamToStringArray(stream)
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)
    if (advancedExpectation) {
      expect(status).not.toEqual("completed")
      expect(outputForm.happy).toEqual(true)
      expect(outputForm.hourOfSleep).toEqual(7)
      expect(!outputForm.weight).toBeTruthy()
    }

    chatMessages.push({ role: "assistant", content: results.join("") })
    chatMessages.push({ role: "user", content: "99.4 kg" })
    const metadata5 = ProviderSpecs.getMetadata()
    metadata5.currentTurn = chatMessages.filter((message) => message.role === "user").length
    metadata5.traceId = traceId
    stream = provider.streamChatResponse({ messages: chatMessages, config, metadata: metadata5 })
    results = await ProviderSpecs.streamToStringArray(stream)
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)

    expect(status).toEqual("completed")
    expect(outputForm.happy).toEqual(true)
    expect(outputForm.hourOfSleep).toEqual(7)
    expect(outputForm.weight).toBeGreaterThan(99)
    expect(outputForm.weight).toBeLessThan(100)
  }

  static async testStreamChatResponseWithToolsBis({
    provider,
    model,
    advancedExpectation,
  }: {
    provider: LLMProvider
    model: string
    advancedExpectation: boolean
  }) {
    const prompt = `##Instructions:
    Your main task is to help the user fill out the form by asking questions and providing guidance.
    Ask one question at a time to fill out the form.
    Here are the form fields to fill:

        happy: Is happy?
        hourOfSleep: How many sleep hours per day?
        weight: weight in kilogrammes (rounded .5)?

    ## Available Tool usage:
    (CRITICAL)You MUST call "fillForm" tool each time you got an information that can be used to fill a field in the form : you should use the last "formState" from the tool to fill the arguments.
    (CRITICAL)You MUST call "fillForm" if the user changes their answer or give an information that can change a field value in the "formState": then call with the argument replaced with the new value.
    If you DONT HAVE any of the information DONT call the tool; only answer to get information from the user.
    After getting response from the tool "fillForm", continue asking the user until the status returned by the tool is "completed".
    (CRITICAL)If the tool result status is "completed" you MUST end calling tool and you MUST send a message to the user that indicates that the form has been completed.
    
    Response language: Always answer in English.`
    const inputSchema = z.object({
      happy: zNullableType(z.boolean(), "Is happy?"),
      hourOfSleep: zNullableType(z.int(), "How many sleep hours per day?"),
      weight: zNullableType(z.number(), "weight in kilogrammes (rounded .5)?"),
    })
    let outputForm: Record<string, boolean | string | number | undefined> = {}
    let status: string = "NOT_STARTED"
    const fillFormTool = tool({
      description: "Fill out a form. Get the values from user's answers.",
      inputSchema,
      outputSchema: z.object({
        status: z
          .enum(["completed", "in_progress"])
          .describe("Whether the form is completed or not"),
        formState: inputSchema.describe(
          "The current state of the form, with values filled by the user",
        ),
      }),
      execute: async (input, _options) => {
        const typedInput = castToolInputParameters(input)
        if (typeof typedInput.happy === "string") {
          if (typedInput.happy.toLowerCase() === "null") input.happy = undefined
          else if (
            typedInput.happy.toLowerCase() === "true" ||
            typedInput.happy.toLowerCase() === "yes"
          )
            input.happy = true
        }
        const hours =
          typeof typedInput.hourOfSleep === "number" ? typedInput.hourOfSleep : undefined
        const weight = typeof typedInput.weight === "number" ? typedInput.weight : undefined
        status = typedInput.happy !== undefined && hours && weight ? "completed" : "in_progress"

        outputForm = castToolInputParameters(input)
        return {
          status,
          formState: input,
        }
      },
    })
    const config = {
      model,
      temperature: ProviderSpecs.temperature,
      systemPrompt: prompt,
      tools: { fillForm: fillFormTool } as ToolSet,
    }
    const chatMessages: LLMChatMessage[] = [{ role: "user", content: "Hello" }]
    const metadata = ProviderSpecs.getMetadata()
    const traceId = metadata.traceId
    metadata.currentTurn = chatMessages.filter((message) => message.role === "user").length
    let stream = provider.streamChatResponse({ messages: chatMessages, config, metadata })
    let results = await ProviderSpecs.streamToStringArray(stream)
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)
    if (advancedExpectation) {
      expect(status).not.toEqual("completed")
      expect(!outputForm.happy).toBeTruthy()
      expect(!outputForm.hourOfSleep).toBeTruthy()
      expect(!outputForm.weight).toBeTruthy()
    }

    chatMessages.push({ role: "assistant", content: results.join("") })
    chatMessages.push({ role: "user", content: "I'm happy" })
    const metadata2 = ProviderSpecs.getMetadata()
    metadata2.currentTurn = chatMessages.filter((message) => message.role === "user").length
    metadata2.traceId = traceId
    stream = provider.streamChatResponse({ messages: chatMessages, config, metadata: metadata2 })
    results = await ProviderSpecs.streamToStringArray(stream)
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)
    if (advancedExpectation) {
      expect(status).not.toEqual("completed")
      expect(outputForm.happy).toBeTruthy()
      expect(!outputForm.hourOfSleep).toBeTruthy()
      expect(!outputForm.weight).toBeTruthy()
    }

    chatMessages.push({ role: "assistant", content: results.join("") })
    chatMessages.push({ role: "user", content: "I sleep about 7 hours a night" })
    const metadata3 = ProviderSpecs.getMetadata()
    metadata3.currentTurn = chatMessages.filter((message) => message.role === "user").length
    metadata3.traceId = traceId
    stream = provider.streamChatResponse({ messages: chatMessages, config, metadata: metadata3 })
    results = await ProviderSpecs.streamToStringArray(stream)
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)
    if (advancedExpectation) {
      expect(status).not.toEqual("completed")
      expect(outputForm.happy).toEqual(true)
      expect(outputForm.hourOfSleep).toEqual(7)
      expect(!outputForm.weight).toBeTruthy()
    }

    chatMessages.push({ role: "assistant", content: results.join("") })
    chatMessages.push({ role: "user", content: "I do not smoke" })
    const metadata4 = ProviderSpecs.getMetadata()
    metadata4.currentTurn = chatMessages.filter((message) => message.role === "user").length
    metadata4.traceId = traceId
    stream = provider.streamChatResponse({ messages: chatMessages, config, metadata: metadata4 })
    results = await ProviderSpecs.streamToStringArray(stream)
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)
    if (advancedExpectation) {
      expect(status).not.toEqual("completed")
      expect(outputForm.happy).toEqual(true)
      expect(outputForm.hourOfSleep).toEqual(7)
      expect(!outputForm.weight).toBeTruthy()
    }

    chatMessages.push({ role: "assistant", content: results.join("") })
    chatMessages.push({ role: "user", content: "99.4 kg" })
    const metadata5 = ProviderSpecs.getMetadata()
    metadata5.currentTurn = chatMessages.filter((message) => message.role === "user").length
    metadata5.traceId = traceId
    stream = provider.streamChatResponse({ messages: chatMessages, config, metadata: metadata5 })
    results = await ProviderSpecs.streamToStringArray(stream)
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)

    expect(status).toEqual("completed")
    expect(outputForm.happy).toEqual(true)
    expect(outputForm.hourOfSleep).toEqual(7)
    expect(outputForm.weight).toBeGreaterThan(99)
    expect(outputForm.weight).toBeLessThan(100)
  }

  static async testStreamChatResponseWithToolsTer({
    provider,
    model,
    advancedExpectation,
  }: {
    provider: LLMProvider
    model: string
    advancedExpectation: boolean
  }) {
    const _prompt_initial = `Today's date: 4/1/2026

## Identity
You are **Warmachine rules**, a conversational AI assistant.

## Purpose
Your purpose is to assist users by answering their questions about a tabletop wargame

## Behavioural Rules
- **Tone**: Friendly, clear, and professional.
- **Brevity**: Provide concise responses focused on the user's needs.
- **Formatting**: Use **bold** for key terms and bullet points for lists.
- **Interactivity**: Ask clarifying questions when the user's request is ambiguous.

## Guardrails
- **Confidentiality**: Do not share any personal or sensitive information.
- **Ethics**: Avoid engaging in discussions that promote harm or illegal activities.

## Tools:
[retrieveProjectDocumentChunks]: When the user asks about information that may exist in project documents, call the retrieveProjectDocumentChunks tool before answering. Use the returned chunks as primary context and avoid inventing facts not present in those chunks.

## Response language:
Always answer in English.`
    const prompt = `Today's date: 4/1/2026

## Identity
You are **Warmachine rules**, a conversational AI assistant.

## Purpose
Your purpose is to assist users by answering their questions about a tabletop wargame.
(CRITICAL) ALWAYS call the available tools to get document chunks before return answer to the user.

## Behavioural Rules
- **Tone**: Friendly, clear, and professional.
- **Brevity**: Provide concise responses focused on the user's needs.
- **Formatting**: Use **bold** for key terms and bullet points for lists.
- **Interactivity**: Ask clarifying questions when the user's request is ambiguous.

## Guardrails
- **Confidentiality**: Do not share any personal or sensitive information.
- **Ethics**: Avoid engaging in discussions that promote harm or illegal activities.

## Response language:
Always answer in English.`
    const inputSchema = z.object({
      conversationSummary: z.string().describe("Summary of the conversation"),
      latestUserQuestion: z.string().describe("Latest user's question"),
      topK: z.number().describe("topK value"),
    })
    const retrieveProjectDocumentChunksTool = tool({
      description: "Retrieve useful Document's Chunks",
      inputSchema,
      outputSchema: undefined,
      // outputSchema: z.object({
      //   status: z
      //       .enum(["completed", "in_progress"])
      //       .describe("Whether the form is completed or not"),
      //   formState: inputSchema.describe(
      //       "The current state of the form, with values filled by the user",
      //   ),
      // }),
      execute: async (input, _options) => {
        return getChunks(input.latestUserQuestion)
      },
    })
    const config = {
      model,
      temperature: ProviderSpecs.temperature,
      systemPrompt: prompt,
      tools: { retrieveProjectDocumentChunks: retrieveProjectDocumentChunksTool } as ToolSet,
    }
    const chatMessages: LLMChatMessage[] = [
      { role: "user", content: "C'est combien de deplacement en plus la charge" },
    ]
    const metadata = ProviderSpecs.getMetadata()
    const traceId = metadata.traceId
    metadata.currentTurn = chatMessages.filter((message) => message.role === "user").length
    let stream = provider.streamChatResponse({ messages: chatMessages, config, metadata })
    let results = await ProviderSpecs.streamToStringArray(stream)
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)
    let result = results.join("")
    if (advancedExpectation) {
      expectIncludes(result, "3")
    }

    chatMessages.push({ role: "assistant", content: results.join("") })
    chatMessages.push({ role: "user", content: "tu m'avais dit 5 pouces" })
    const metadata2 = ProviderSpecs.getMetadata()
    metadata2.currentTurn = chatMessages.filter((message) => message.role === "user").length
    metadata2.traceId = traceId
    stream = provider.streamChatResponse({ messages: chatMessages, config, metadata: metadata2 })
    results = await ProviderSpecs.streamToStringArray(stream)
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)
    result = results.join("")
    if (advancedExpectation) {
      expectIncludesAtLeastOne(result, ["course", "run", "bonus"])
      expectIncludes(result, "5")
    }

    chatMessages.push({ role: "assistant", content: results.join("") })
    chatMessages.push({ role: "user", content: "oui" })
    const metadata3 = ProviderSpecs.getMetadata()
    metadata3.currentTurn = chatMessages.filter((message) => message.role === "user").length
    metadata3.traceId = traceId
    stream = provider.streamChatResponse({ messages: chatMessages, config, metadata: metadata3 })
    results = await ProviderSpecs.streamToStringArray(stream)
    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThan(0)
    result = results.join("")
    if (advancedExpectation) {
      expectIncludesAtLeastOne(result, ["warmachine", "SPD"])
    }
  }

  private static async streamToStringArray(
    stream: AsyncGenerator<string, void, unknown>,
  ): Promise<string[]> {
    const values: string[] = []
    for await (const chunk of stream) {
      values.push(chunk)
    }
    return values
  }

  static async testGenerateStructuredOutputFromPdf({
    provider,
    model,
  }: {
    provider: LLMProvider
    model: string
  }) {
    const prompt = `From the file, get the expected values and replace the phone number by 007.
DO NOT HALLUCINATE VALUES, return only values that you find in the file; if no values then return undefined`
    const metadata = ProviderSpecs.getMetadata()
    const schema = z.object({ adresse: z.string(), telephone: z.string(), courriel: z.string() })
    const filename = "test-pdf.pdf"
    const buffer = await readFile(join(__dirname, `files`, filename))
    const message: LLMChatMessage = {
      role: "user",
      content: [
        {
          type: "text",
          text: prompt,
        },
        {
          type: "file",
          filename,
          mediaType: "application/pdf",
          data: buffer,
        },
      ],
    }
    const config = {
      model,
      temperature: ProviderSpecs.temperature,
      systemPrompt: ProviderSpecs.systemPrompt,
    }
    const result = await provider.generateStructuredOutput({
      message,
      schema: schema.toJSONSchema(),
      config,
      metadata,
    })
    expect(result).toBeDefined()
    expect(() => schema.parse(result)).not.toThrow()
    const parsed = schema.parse(result)
    expectIncludes(parsed.adresse, "dreux")
    expect(parsed.telephone.toLowerCase()).toBe("007")
    expect(parsed.courriel.toLowerCase()).toBe("jdoudou@laposte.net")
  }
  static async testGenerateStructuredOutputFromMathematicalJpg({
    provider,
    model,
  }: {
    provider: LLMProvider
    model: string
  }) {
    const prompt = `From the input table, extract each constant name and its value. 
Output the full list unchanged, except for the constant named ‘Pi’, which must have its value replaced by 0.007.`
    const metadata = ProviderSpecs.getMetadata()
    const schema = z.array(
      z.object({
        constantName: z.string().describe("the name of the constant"),
        value: z.number().describe("the value of the constant"),
      }),
    )
    const filename = "test-jpg.jpg"
    const buffer = await readFile(join(__dirname, `files`, filename))
    const message: LLMChatMessage = {
      role: "user",
      content: [
        {
          type: "text",
          text: prompt,
        },
        {
          type: "file",
          filename,
          mediaType: "image/jpeg",
          data: buffer,
        },
      ],
    }
    const config = {
      model,
      temperature: ProviderSpecs.temperature,
      systemPrompt: ProviderSpecs.systemPrompt,
    }
    const result = await provider.generateStructuredOutput({
      message,
      schema: schema.toJSONSchema(),
      config,
      metadata,
    })
    expect(result).toBeDefined()
    expect(() => schema.parse(result)).not.toThrow()
    const parsed = schema.parse(result)
    expect(parsed.length).toBe(8)
    const catalan = parsed.filter((c) => includesInsensitive(c.constantName, "catalan"))
    expect(catalan.length).toBe(1)
    expect(catalan[0]?.value).toBe(0.9159655941)
    const pi = parsed.filter((c) => includesInsensitive(c.constantName, "pi"))
    expect(pi.length).toBe(1)
    expect(pi[0]?.value).toBe(0.007)
  }

  static async testGenerateStructuredOutputFromXRayPng_FR({
    provider,
    model,
  }: {
    provider: LLMProvider
    model: string
  }) {
    const filename = "xray-png.png"
    await ProviderSpecs.testGenerateStructuredOutputFromXRay(filename, model, provider)
  }

  static async testGenerateStructuredOutputFromXRayLowPng_FR({
    provider,
    model,
  }: {
    provider: LLMProvider
    model: string
  }) {
    const filename = "xray-micro-png.png"
    await ProviderSpecs.testGenerateStructuredOutputFromXRay(filename, model, provider)
  }

  static async testGenerateStructuredOutputFromXRayJpg_FR({
    provider,
    model,
  }: {
    provider: LLMProvider
    model: string
  }) {
    const filename = "xray-jpg.jpg"
    await ProviderSpecs.testGenerateStructuredOutputFromXRay(filename, model, provider)
  }

  private static async testGenerateStructuredOutputFromXRay(
    filename: string,
    model: string,
    provider: LLMProvider,
  ) {
    const systemPromptFr =
      "Tu es un chat bot nommé Elvis. Ton objectif est de répondre aux utilisateurs en focntion des connaissances dont tu disposes"
    const prompt = `Analyse cette radiographie et extrais les informations sous format JSON strict.`
    const metadata = ProviderSpecs.getMetadata()
    const emergencyLevel = ["faible", "moyen", "eleve"]
    const schema = z.object({
      anomalie_detectee: z.boolean(),
      description: z.string(),
      niveau_urgence: z.enum(emergencyLevel),
      recommandation: z.string(),
    })
    const buffer = await readFile(join(__dirname, `files`, filename))
    const message: LLMChatMessage = {
      role: "user",
      content: [
        {
          type: "text",
          text: prompt,
        },
        {
          type: "file",
          filename,
          mediaType: "image/jpeg",
          data: buffer,
        },
      ],
    }
    const config = {
      model,
      temperature: ProviderSpecs.temperature,
      systemPrompt: systemPromptFr,
    }
    const result = await provider.generateStructuredOutput({
      message,
      schema: schema.toJSONSchema(),
      config,
      metadata,
    })
    expect(result).toBeDefined()
    expect(() => schema.parse(result)).not.toThrow()
    const parsed = schema.parse(result)
    expect(parsed).toBeDefined()
    expect(parsed.anomalie_detectee).toBeDefined()
    expect(parsed.description.length).toBeGreaterThan(0)
    expect(emergencyLevel.some((el) => el === parsed.niveau_urgence)).toBeTruthy()
    expect(parsed.recommandation.length).toBeGreaterThan(0)
  }
}

function getChunks(latestUserQuestion) {
  if (
    latestUserQuestion.includes("charge") &&
    latestUserQuestion.includes("movement") &&
    latestUserQuestion.includes("distance")
  )
    return {
      retrievedChunks: [
        {
          chunkId: "73f754e6-f95d-44a0-a94b-d4f81bcf0eff",
          content: "headings: ['CONTENTS']\n\nFocus: Run or Charge  ...................... 102",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 65,
          modelName: "gemini-embedding-001",
          distance: 0.3352440595626831,
        },
        {
          chunkId: "98317967-5608-4eeb-b4d0-c50310928a27",
          content:
            "headings: ['Independent Model Charges']\n\nSome models must meet special requirements to charge:",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 357,
          modelName: "gemini-embedding-001",
          distance: 0.33993234158368335,
        },
        {
          chunkId: "4f97c64a-7e39-49ce-8ce6-e715c3ad72a2",
          content:
            "headings: ['Unit Charges']\n\nAfter declaring a charge, the charging model then advances up to its current SPD plus 3' in a straight line in any direction that will bring its target into its melee range when it moves, ignoring terrain, the distance to the charge target, and other models. The charging model cannot voluntarily stop its movement until its target is in its melee range, but at that point, it can end this movement at any time. The charging model stops if it contacts a model, an obstacle, or an obstruction or if it is pushed, slammed, thrown, or placed during its charge movement. If the model contacts another model, an obstacle, or an obstruction while charging but is able to move through it for some reason (such as a special rule on the model), the charging model does not stop but is still considered to have contacted the model, obstacle, or obstruction.",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 362,
          modelName: "gemini-embedding-001",
          distance: 0.3412973488150435,
        },
        {
          chunkId: "11b3bd15-54fb-4588-a199-bef4ef3b4ff7",
          content: "headings: ['MOVEMENT IN A NUTSHELL']\n\n3",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 380,
          modelName: "gemini-embedding-001",
          distance: 0.34355245064355255,
        },
        {
          chunkId: "57c9ba37-73f9-474c-aefb-4a12149557c8",
          content:
            "headings: ['Unit Charges']\n\nAfter the charging model completes its charge movement, place the other troopers in its unit within 2' of that model as normal.",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 363,
          modelName: "gemini-embedding-001",
          distance: 0.34848666191101074,
        },
        {
          chunkId: "1358c9ed-3ff9-46be-9957-d0f77c542be6",
          content:
            "headings: ['CHARGE']\n\nThe model or unit rushes into melee range with a target and takes advantage of its momentum to make a more powerful first strike.",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 349,
          modelName: "gemini-embedding-001",
          distance: 0.35055132809587175,
        },
        {
          chunkId: "67f4fe3b-0f9e-4451-b208-2a99f70a8908",
          content:
            "headings: ['Independent Model Charges']\n\nThe charging model cannot voluntarily stop its movement until its target is in its melee range, but at that point, it can end this movement at any time. Once the charging model has the charge target in its melee range, it must keep the charge target in its melee range for the rest of the charge. The charging model stops if it contacts a model, an obstacle, or an obstruction or if it is pushed, slammed, thrown, or placed during its charge movement. If a model contacts another model, an obstacle, or an obstruction while charging but is able to move through it for some reason (such as a special rule on the model), the charging model does not stop but is still considered to have contacted the model, obstacle, or obstruction.",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 352,
          modelName: "gemini-embedding-001",
          distance: 0.3517920005011488,
        },
        {
          chunkId: "baf28091-b9a7-4989-911f-4134e6f92fc2",
          content: "headings: ['CONTENTS']\n\nForced: Run or Charge .................... 106",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 103,
          modelName: "gemini-embedding-001",
          distance: 0.35299694538116455,
        },
        {
          chunkId: "14f0a161-db92-4040-b644-f6b571f92419",
          content: "headings: ['DETERMINING MODEL VOLUME']\n\nC",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 432,
          modelName: "gemini-embedding-001",
          distance: 0.3572015166282654,
        },
        {
          chunkId: "b827f0df-8f22-4e06-bf1d-48ef96dfb0c6",
          content: "headings: ['DETERMINING MODEL VOLUME']\n\nD",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 434,
          modelName: "gemini-embedding-001",
          distance: 0.3579861926432306,
        },
        {
          chunkId: "bcb0b1b7-3dce-45a8-831d-26c4309a50f0",
          content:
            "headings: ['Independent Model Charges']\n\nA charging model with its charge target in its melee range at the end of its charge movement has made a successful charge. The charging model must use its Combat Action to make either initial melee attacks or a special attack with a melee weapon.",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 353,
          modelName: "gemini-embedding-001",
          distance: 0.3590634633226989,
        },
        {
          chunkId: "c5ca545f-9da0-4125-8d88-cbefb401ae86",
          content:
            "headings: ['MEASURING DISTANCES']\n\nA model is within a given distance when the nearest edge of its base is within that distance. If two models are exactly a certain distance apart, they are considered to be within that distance of each other.",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 175,
          modelName: "gemini-embedding-001",
          distance: 0.3593830466270447,
        },
        {
          chunkId: "fb2504c2-45f4-4a24-979f-1c852d5f2ab7",
          content:
            "headings: ['UNINTENTIONAL MOVEMENT']\n\nModels can move without advancing as a result of being pushed or slammed or from other effects. Determine the distance a model moves in this way by measuring how far the leading edge of its base travels. Remember, unintentional movement is not advancing.",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 381,
          modelName: "gemini-embedding-001",
          distance: 0.3604219389464737,
        },
        {
          chunkId: "fb0587d4-ed28-4e6c-95b4-0dbd2c82c1ac",
          content:
            "headings: ['Unit Charges']\n\nIf the charging model ends its charge movement without its charge target in its melee range, it has made a failed charge. If a trooper model fails a charge for its unit, after the other troopers in unit have been placed within 2' of the charging model the unit's activation ends.",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 364,
          modelName: "gemini-embedding-001",
          distance: 0.36081361770629883,
        },
        {
          chunkId: "ff63bb8c-9182-4537-8e2c-fb636b15990b",
          content:
            "headings: ['BY ANY OTHER NAME']\n\nRemember that all intentional movement - whether full advancing,  running,  or  charging  -  is  considered  to  be advancing regardless of whether it takes place during a model's Normal Movement or not.",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 340,
          modelName: "gemini-embedding-001",
          distance: 0.3608857774206521,
        },
        {
          chunkId: "849097b3-0e91-4af7-90a6-6da900bdec55",
          content:
            "headings: ['Independent Model Charges']\n\nWhen an independent model charges, begin by declaring the charge and its target before moving the model. A model requires line of sight to another model to target it with a charge (see 'Line of Sight & Targeting' page 80 for details). After declaring a charge, the charging model then advances up to its current SPD plus 3' in a straight line in any direction that will bring its target into its melee range when it moves, ignoring terrain, the distance to the charge target, and other models.",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 351,
          modelName: "gemini-embedding-001",
          distance: 0.360949196758913,
        },
        {
          chunkId: "d68b9bd5-345b-479a-a58a-2918584ca293",
          content:
            "headings: ['RUN']\n\nThe model or unit advances up to its current SPD plus 5' .",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 344,
          modelName: "gemini-embedding-001",
          distance: 0.36242600455439,
        },
        {
          chunkId: "69090560-02ac-4841-b858-eba4bd0d0be9",
          content:
            "headings: ['Independent Model Charges']\n\nIf a charging model ends its charge movement without its charge target in its melee range, it has made a failed charge. If a model makes a failed charge during its activation, its activation ends.",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 356,
          modelName: "gemini-embedding-001",
          distance: 0.3637997318446553,
        },
        {
          chunkId: "271b7820-e06a-4115-90d2-386c68bdc45a",
          content: "headings: ['UNIT MOVEMENT']\n\n3",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 335,
          modelName: "gemini-embedding-001",
          distance: 0.3642897767675144,
        },
        {
          chunkId: "c68cc25d-d66d-475b-a4c6-c8691b8aeac3",
          content:
            "headings: ['NORMAL MOVEMENT']\n\n- ⚙ Forfeit its Normal Movement\n- ⚙ Aim\n- ⚙ Full advance\n- ⚙ Run\n- ⚙ Charge",
          documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
          documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
          chunkIndex: 338,
          modelName: "gemini-embedding-001",
          distance: 0.3649945694201626,
        },
      ],
      retrievalMetadata: {
        returnedChunkCount: 20,
        topK: 20,
      },
    }
  return {
    retrievedChunks: [
      {
        chunkId: "4f97c64a-7e39-49ce-8ce6-e715c3ad72a2",
        content:
          "headings: ['Unit Charges']\n\nAfter declaring a charge, the charging model then advances up to its current SPD plus 3' in a straight line in any direction that will bring its target into its melee range when it moves, ignoring terrain, the distance to the charge target, and other models. The charging model cannot voluntarily stop its movement until its target is in its melee range, but at that point, it can end this movement at any time. The charging model stops if it contacts a model, an obstacle, or an obstruction or if it is pushed, slammed, thrown, or placed during its charge movement. If the model contacts another model, an obstacle, or an obstruction while charging but is able to move through it for some reason (such as a special rule on the model), the charging model does not stop but is still considered to have contacted the model, obstacle, or obstruction.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 362,
        modelName: "gemini-embedding-001",
        distance: 0.25033096967153723,
      },
      {
        chunkId: "57c9ba37-73f9-474c-aefb-4a12149557c8",
        content:
          "headings: ['Unit Charges']\n\nAfter the charging model completes its charge movement, place the other troopers in its unit within 2' of that model as normal.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 363,
        modelName: "gemini-embedding-001",
        distance: 0.25831624766394,
      },
      {
        chunkId: "5b340779-0d81-4d93-972e-fdfdc227d58c",
        content:
          "headings: ['Independent Model Charges']\n\n- ⚙ A warjack must spend 1 focus point to use its Normal Movement to charge.\n- ⚙ A warbeast must be forced to use its Normal Movement to charge.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 358,
        modelName: "gemini-embedding-001",
        distance: 0.2714320855479073,
      },
      {
        chunkId: "9a42e995-8b47-4792-b3c1-0d6262d3b59f",
        content:
          "headings: ['Required Charges']\n\nSome effects require a model to charge. If a model is required to charge and either it cannot or there are no legal charge targets in its line of sight, the model activates but must forfeit its Normal Movement and Combat Action.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 370,
        modelName: "gemini-embedding-001",
        distance: 0.27404746126562307,
      },
      {
        chunkId: "fb0587d4-ed28-4e6c-95b4-0dbd2c82c1ac",
        content:
          "headings: ['Unit Charges']\n\nIf the charging model ends its charge movement without its charge target in its melee range, it has made a failed charge. If a trooper model fails a charge for its unit, after the other troopers in unit have been placed within 2' of the charging model the unit's activation ends.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 364,
        modelName: "gemini-embedding-001",
        distance: 0.2740932376273536,
      },
      {
        chunkId: "849097b3-0e91-4af7-90a6-6da900bdec55",
        content:
          "headings: ['Independent Model Charges']\n\nWhen an independent model charges, begin by declaring the charge and its target before moving the model. A model requires line of sight to another model to target it with a charge (see 'Line of Sight & Targeting' page 80 for details). After declaring a charge, the charging model then advances up to its current SPD plus 3' in a straight line in any direction that will bring its target into its melee range when it moves, ignoring terrain, the distance to the charge target, and other models.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 351,
        modelName: "gemini-embedding-001",
        distance: 0.2782982686224683,
      },
      {
        chunkId: "5ffd28fe-90fb-47b2-91a8-929ea4b22ffd",
        content:
          "headings: ['Focus: Charge']\n\nA monstrosity must spend 1 focus point in order to use its Normal Movement to charge.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 857,
        modelName: "gemini-embedding-001",
        distance: 0.2791077757945277,
      },
      {
        chunkId: "24b03b56-5543-4c88-8e0f-2e20185e354a",
        content:
          "headings: ['Independent Model Charges']\n\nIf a charging model moved less than 3' , its first attack with a melee weapon is not a charge attack. Its first attack must still be made against the charge target, however.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 355,
        modelName: "gemini-embedding-001",
        distance: 0.2802083158244659,
      },
      {
        chunkId: "d20b1560-c50c-45c2-b518-7bc7fed0f719",
        content:
          "headings: ['Unit Charges']\n\nWhen a unit charges as part of its Normal Movement, select one unengaged model (see page 86) to move for the unit as described in Unit Movement (see page 73). Declare the charge and its target before moving that model. That model requires line of sight to another model to target it with a charge. Remember, models in a unit do not block the line of sight of other models in their unit (see 'Line of Sight & Targeting' page 80).",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 361,
        modelName: "gemini-embedding-001",
        distance: 0.28132903575895174,
      },
      {
        chunkId: "67f4fe3b-0f9e-4451-b208-2a99f70a8908",
        content:
          "headings: ['Independent Model Charges']\n\nThe charging model cannot voluntarily stop its movement until its target is in its melee range, but at that point, it can end this movement at any time. Once the charging model has the charge target in its melee range, it must keep the charge target in its melee range for the rest of the charge. The charging model stops if it contacts a model, an obstacle, or an obstruction or if it is pushed, slammed, thrown, or placed during its charge movement. If a model contacts another model, an obstacle, or an obstruction while charging but is able to move through it for some reason (such as a special rule on the model), the charging model does not stop but is still considered to have contacted the model, obstacle, or obstruction.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 352,
        modelName: "gemini-embedding-001",
        distance: 0.28159151320429576,
      },
      {
        chunkId: "1358c9ed-3ff9-46be-9957-d0f77c542be6",
        content:
          "headings: ['CHARGE']\n\nThe model or unit rushes into melee range with a target and takes advantage of its momentum to make a more powerful first strike.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 349,
        modelName: "gemini-embedding-001",
        distance: 0.2827977965594537,
      },
      {
        chunkId: "69090560-02ac-4841-b858-eba4bd0d0be9",
        content:
          "headings: ['Independent Model Charges']\n\nIf a charging model ends its charge movement without its charge target in its melee range, it has made a failed charge. If a model makes a failed charge during its activation, its activation ends.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 356,
        modelName: "gemini-embedding-001",
        distance: 0.28812122749197644,
      },
      {
        chunkId: "ff63bb8c-9182-4537-8e2c-fb636b15990b",
        content:
          "headings: ['BY ANY OTHER NAME']\n\nRemember that all intentional movement - whether full advancing,  running,  or  charging  -  is  considered  to  be advancing regardless of whether it takes place during a model's Normal Movement or not.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 340,
        modelName: "gemini-embedding-001",
        distance: 0.28884495100171126,
      },
      {
        chunkId: "4fc70704-3cfa-446d-a2e6-68a8e00413f3",
        content:
          "headings: ['Unit Charges']\n\nIf the charging model advanced at least 3' during its charge movement, the first attack with a melee weapon made by each model in the unit this activation targeting a model/unit that was in the charging model's melee range at the end of its charge movement are charge attacks.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 367,
        modelName: "gemini-embedding-001",
        distance: 0.288947990191462,
      },
      {
        chunkId: "e278aa9d-c348-4d09-bdc8-1ea8ed4dbcd2",
        content: "headings: ['CHARGE']\n\nA model that does not have a melee weapon cannot charge.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 350,
        modelName: "gemini-embedding-001",
        distance: 0.2890965170206602,
      },
      {
        chunkId: "70a04cad-31b1-4ff6-a28e-d695da5c5947",
        content:
          "headings: ['RUNNING AND END OF TURN MOVEMENT']\n\nNote that because a running model or unit's activation ends as it completes its run movement or fails a charge, running models and those that fail a charge do not benefit from special rules granting end of activation movement (see page 77), such as Reposition.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 348,
        modelName: "gemini-embedding-001",
        distance: 0.291209739970569,
      },
      {
        chunkId: "33053a89-111d-4a98-b146-3f42073616eb",
        content:
          "headings: ['FORFEITING NORMAL MOVEMENT']\n\nSee 'Forfeiting Normal Movement or Combat Actions' page 73.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 341,
        modelName: "gemini-embedding-001",
        distance: 0.29300479334563123,
      },
      {
        chunkId: "c68cc25d-d66d-475b-a4c6-c8691b8aeac3",
        content:
          "headings: ['NORMAL MOVEMENT']\n\n- ⚙ Forfeit its Normal Movement\n- ⚙ Aim\n- ⚙ Full advance\n- ⚙ Run\n- ⚙ Charge",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 338,
        modelName: "gemini-embedding-001",
        distance: 0.29419422149656194,
      },
      {
        chunkId: "7def5e21-2da6-43a4-b7a9-5bcf1b77ccbe",
        content:
          "headings: ['RUNNING AND CHARGING']\n\nA horror can normally use its Normal Movement to run or charge without spending an essence point. A horror with a crippled outer damage ring (see below) must spend an essence point to run or charge.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 1146,
        modelName: "gemini-embedding-001",
        distance: 0.29484861019882913,
      },
      {
        chunkId: "22fb5fee-9ccf-4689-8c1a-7be788074e95",
        content:
          "headings: ['FOCUS: RUN OR CHARGE']\n\nA warjack must spend 1 focus point in order to use its Normal Movement to run or charge.",
        documentTitle: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        documentId: "63ca128f-c24c-4241-9561-8e265a414f34",
        documentFileName: "WMH-MK4-Rulebook_Digital_144-OP_Abridged.pdf",
        chunkIndex: 691,
        modelName: "gemini-embedding-001",
        distance: 0.29511753945841024,
      },
    ],
    retrievalMetadata: {
      returnedChunkCount: 20,
      topK: 20,
    },
  }
}
