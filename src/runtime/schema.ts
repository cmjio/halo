/**
 * Output validation for `pipeline P(...) -> Schema`.
 *
 * Field types: String, Number, Integer, Boolean, Array / List (optionally
 * `Array<T>`), Object / JSON / Any, or another schema's name (nested).
 */

import type { SchemaDeclaration } from "../parser/types.js";
import { SchemaValidationError } from "./errors.js";
import { parseOutput } from "./values.js";

type Lookup = (name: string) => SchemaDeclaration | undefined;

/** Parse a type like `Array<Map<String, Number>>` into its base and arguments. */
function parseType(type: string): { base: string; args: string[] } {
  const lt = type.indexOf("<");
  if (lt < 0) return { base: type.trim(), args: [] };
  const inner = type.slice(lt + 1, type.lastIndexOf(">"));
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "<") depth++;
    else if (inner[i] === ">") depth--;
    else if (inner[i] === "," && depth === 0) {
      args.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  args.push(inner.slice(start).trim());
  return { base: type.slice(0, lt).trim(), args };
}

function describe(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "nothing";
  if (Array.isArray(v)) return "a list";
  return typeof v === "object" ? "an object" : `a ${typeof v} (${JSON.stringify(v)?.slice(0, 40)})`;
}

/** Returns a problem description, or undefined when `value` matches `type`. */
function check(value: unknown, type: string, path: string, lookup: Lookup): string | undefined {
  const { base, args } = parseType(type);
  switch (base) {
    case "String":
      return typeof value === "string" ? undefined : `${path} should be a String, got ${describe(value)}`;
    case "Number":
      return typeof value === "number" && Number.isFinite(value) ? undefined : `${path} should be a Number, got ${describe(value)}`;
    case "Integer":
      return Number.isInteger(value) ? undefined : `${path} should be an Integer, got ${describe(value)}`;
    case "Boolean":
      return typeof value === "boolean" ? undefined : `${path} should be a Boolean, got ${describe(value)}`;
    case "Array":
    case "List": {
      if (!Array.isArray(value)) return `${path} should be a list, got ${describe(value)}`;
      if (!args[0]) return undefined;
      for (const [i, item] of value.entries()) {
        const problem = check(item, args[0], `${path}[${i}]`, lookup);
        if (problem) return problem;
      }
      return undefined;
    }
    case "Object":
    case "JSON":
    case "Map":
      return value !== null && typeof value === "object" && !Array.isArray(value) ? undefined : `${path} should be an object, got ${describe(value)}`;
    case "Any":
      return undefined;
  }
  const schema = lookup(base);
  if (!schema) return undefined; // unknown types are not checked (the validator warns about them)
  return checkObject(value, schema, path, lookup);
}

function checkObject(value: unknown, schema: SchemaDeclaration, path: string, lookup: Lookup): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return `${path || "output"} should be an object matching ${schema.name}, got ${describe(value)}`;
  }
  const obj = value as Record<string, unknown>;
  for (const f of schema.fields) {
    const fieldPath = path ? `${path}.${f.name}` : f.name;
    if (!(f.name in obj) || obj[f.name] === undefined) return `missing field "${fieldPath}"`;
    const problem = check(obj[f.name], f.type, fieldPath, lookup);
    if (problem) return problem;
  }
  return undefined;
}

/**
 * Check `output` against `schema`. A string is parsed as JSON first (models
 * answer in text). Returns the parsed value; throws SchemaValidationError.
 */
export function validateSchema(schema: SchemaDeclaration, output: unknown, lookup: Lookup): unknown {
  const value = typeof output === "string" ? parseOutput(output) : output;
  if (typeof value === "string") throw new SchemaValidationError(schema.name, `output is not JSON: ${JSON.stringify(value.slice(0, 80))}`);
  const problem = checkObject(value, schema, "", lookup);
  if (problem) throw new SchemaValidationError(schema.name, problem);
  return value;
}
