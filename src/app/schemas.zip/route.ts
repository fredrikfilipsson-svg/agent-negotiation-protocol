import { zipSync, strToU8 } from "fflate";
import { readSchema, SCHEMA_FILES } from "@/lib/protocol";

export const dynamic = "force-static";

/**
 * All three schemas in one zip, assembled at build time from the files in
 * `protocol/schemas/`.
 */
export function GET() {
  const entries: Record<string, Uint8Array> = {};
  for (const name of SCHEMA_FILES) {
    entries[name] = strToU8(readSchema(name));
  }
  const zip = zipSync(entries, { level: 9 });
  return new Response(new Uint8Array(zip), {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="anp-0.1-schemas.zip"',
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=3600, must-revalidate",
    },
  });
}
