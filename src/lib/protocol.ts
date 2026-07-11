import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Build-time readers for the authoritative protocol artifacts in
 * `protocol/`. The site never keeps copies of these texts; every page that
 * shows the spec, the license or a schema reads the file itself.
 */

const PROTOCOL_DIR = join(process.cwd(), "protocol");

export const SCHEMA_FILES = [
  "envelope.schema.json",
  "offer.schema.json",
  "event.schema.json",
] as const;

export type SchemaFileName = (typeof SCHEMA_FILES)[number];

export function readSpec(): string {
  return readFileSync(join(PROTOCOL_DIR, "SPEC.md"), "utf8");
}

export function readLicense(): string {
  return readFileSync(join(PROTOCOL_DIR, "LICENSE"), "utf8");
}

export function readSchema(name: SchemaFileName): string {
  return readFileSync(join(PROTOCOL_DIR, "schemas", name), "utf8");
}

export function readExampleLog(): string {
  return readFileSync(
    join(PROTOCOL_DIR, "examples", "session-log.example.json"),
    "utf8",
  );
}
