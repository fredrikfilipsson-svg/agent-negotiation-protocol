/**
 * Canonical JSON per ANP/0.1 section 4: object keys sorted lexicographically
 * at every depth, no insignificant whitespace, `undefined` members dropped,
 * UTF-8. Both sides of a session must produce identical bytes for identical
 * payloads, so this serializer is strict: values that have no canonical JSON
 * form (functions, symbols, bigints, non finite numbers, cycles) throw
 * instead of being silently coerced.
 */

import { utf8 } from "./encoding";

/**
 * Serialize a JSON-compatible value to its canonical JSON string.
 *
 * @throws {TypeError} on values with no canonical form: `undefined` at the
 * top level or inside an array, functions, symbols, bigints, `NaN`,
 * `Infinity`, and circular references. Object members whose value is
 * `undefined` are dropped, matching the spec.
 */
export function canonicalJson(value: unknown): string {
  return serialize(value, new Set(), "value");
}

/** Canonical JSON as UTF-8 bytes, the exact bytes that get hashed. */
export function canonicalJsonBytes(value: unknown): Uint8Array {
  return utf8(canonicalJson(value));
}

function serialize(value: unknown, seen: Set<object>, path: string): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError(
          `canonical JSON cannot represent non finite number at ${path}`,
        );
      }
      return JSON.stringify(value);
    case "object":
      break;
    default:
      throw new TypeError(
        `canonical JSON cannot represent a ${typeof value} at ${path}`,
      );
  }

  const obj = value as object;
  if (seen.has(obj)) {
    throw new TypeError(`circular reference at ${path}`);
  }
  seen.add(obj);

  let out: string;
  if (Array.isArray(obj)) {
    const items = obj.map((item, i) => {
      if (item === undefined) {
        throw new TypeError(
          `canonical JSON cannot represent undefined inside an array at ${path}[${i}]`,
        );
      }
      return serialize(item, seen, `${path}[${i}]`);
    });
    out = `[${items.join(",")}]`;
  } else {
    const keys = Object.keys(obj)
      .filter((k) => (obj as Record<string, unknown>)[k] !== undefined)
      .sort();
    const members = keys.map((k) => {
      const v = (obj as Record<string, unknown>)[k];
      return `${JSON.stringify(k)}:${serialize(v, seen, `${path}.${k}`)}`;
    });
    out = `{${members.join(",")}}`;
  }

  seen.delete(obj);
  return out;
}
