/** biome-ignore-all lint/suspicious/noExplicitAny: generic helper */

import { NotImplementedException } from "@nestjs/common"
import type { JSONSchema7Definition, JSONSchema7TypeName } from "json-schema"
import { z } from "zod"

export function generateRandomFromSchema(schema: z.ZodTypeAny, keyName?: string): any {
  const type = (schema._def as any).typeName

  switch (type) {
    case z.ZodString:
      return keyName ? `${keyName}-value` : "string-value"

    case z.ZodNumber:
      return Math.floor(Math.random() * 1000)

    case z.ZodBoolean:
      return Math.random() > 0.5

    case z.ZodBigInt:
      return BigInt(Math.floor(Math.random() * 100000))

    case z.ZodDate:
      return new Date()

    case z.ZodLiteral:
      return (schema._def as any).value

    case z.ZodEnum: {
      const values = (schema._def as any).values
      return values[Math.floor(Math.random() * values.length)]
    }

    case z.ZodObject: {
      const shape = (schema._def as any).shape()
      const result: Record<string, any> = {}

      for (const key in shape) {
        result[key] = generateRandomFromSchema(shape[key], key)
      }

      return result
    }

    case z.ZodArray:
      return [
        generateRandomFromSchema((schema._def as any).type, keyName),
        generateRandomFromSchema((schema._def as any).type, keyName),
      ]

    case z.ZodTuple:
      return (schema._def as any).items.map((item: z.ZodTypeAny, index: number) =>
        generateRandomFromSchema(item, `${keyName || "item"}_${index}`),
      )

    case z.ZodUnion: {
      const options = (schema._def as any).options
      const chosen = options[Math.floor(Math.random() * options.length)]
      return generateRandomFromSchema(chosen, keyName)
    }

    case z.ZodDiscriminatedUnion: {
      const options = Array.from((schema._def as any).options.values())
      const chosen = options[Math.floor(Math.random() * options.length)]
      return generateRandomFromSchema(chosen as any, keyName)
    }

    case z.ZodRecord: {
      const valueSchema = (schema._def as any).valueType
      return {
        key1: generateRandomFromSchema(valueSchema, "key1"),
        key2: generateRandomFromSchema(valueSchema, "key2"),
      }
    }

    case z.ZodMap: {
      const keySchema = (schema._def as any).keyType
      const valueSchema = (schema._def as any).valueType
      return new Map([
        [
          generateRandomFromSchema(keySchema, "mapKey"),
          generateRandomFromSchema(valueSchema, "mapValue"),
        ],
      ])
    }

    case z.ZodSet: {
      const valueSchema = (schema._def as any).valueType
      return new Set([
        generateRandomFromSchema(valueSchema, keyName),
        generateRandomFromSchema(valueSchema, keyName),
      ])
    }

    case z.ZodOptional:
      return generateRandomFromSchema((schema._def as any).innerType, keyName)

    case z.ZodNullable:
      return generateRandomFromSchema((schema._def as any).innerType, keyName)

    case z.ZodDefault:
      return generateRandomFromSchema((schema._def as any).innerType, keyName)

    case z.ZodAny:
      return keyName ? `${keyName}-any-value` : "any-value"

    case z.ZodUnknown:
      return keyName ? `${keyName}-unknown-value` : "unknown-value"

    default:
      throw new NotImplementedException(`DEV - unsupported Type : ${type}`)
  }
}

export function generateRandomFromJSONSchema(schema: JSONSchema7Definition, keyName?: string): any {
  if (typeof schema === "boolean") {
    return schema ? (keyName ? `${keyName}-value` : "value") : undefined
  }

  if (schema.const !== undefined) {
    return schema.const
  }

  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[Math.floor(Math.random() * schema.enum.length)]
  }

  const combinator = schema.anyOf ?? schema.oneOf
  if (combinator && combinator.length > 0) {
    const chosen = combinator[
      Math.floor(Math.random() * combinator.length)
    ] as JSONSchema7Definition
    return generateRandomFromJSONSchema(chosen, keyName)
  }

  if (schema.allOf && schema.allOf.length > 0) {
    const merged: Record<string, any> = {}
    for (const branch of schema.allOf) {
      const value = generateRandomFromJSONSchema(branch, keyName)
      if (value && typeof value === "object") {
        Object.assign(merged, value)
      }
    }
    return merged
  }

  const type: JSONSchema7TypeName | undefined = Array.isArray(schema.type)
    ? (schema.type.find((typeName) => typeName !== "null") ?? schema.type[0])
    : schema.type

  switch (type) {
    case "string":
      return keyName ? `${keyName}-value` : "string-value"

    case "integer":
    case "number":
      return Math.floor(Math.random() * 1000)

    case "boolean":
      return Math.random() > 0.5

    case "null":
      return null

    case "object": {
      const properties = schema.properties ?? {}
      const result: Record<string, any> = {}

      for (const key in properties) {
        const propertySchema = properties[key]
        if (propertySchema === undefined) continue
        result[key] = generateRandomFromJSONSchema(propertySchema, key)
      }

      return result
    }

    case "array": {
      const items = Array.isArray(schema.items) ? schema.items[0] : schema.items
      if (items === undefined) {
        return []
      }
      return [
        generateRandomFromJSONSchema(items, keyName),
        generateRandomFromJSONSchema(items, keyName),
      ]
    }

    default: {
      if (schema.properties) {
        return generateRandomFromJSONSchema({ ...schema, type: "object" }, keyName)
      }
      throw new NotImplementedException(`DEV - unsupported Type : ${type}`)
    }
  }
}
