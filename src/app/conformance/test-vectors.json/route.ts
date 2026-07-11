import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rawJsonResponse } from "@/lib/rawResponse";

export const dynamic = "force-static";

/**
 * Published test vectors for implementers, regenerated with
 * scripts/generate-test-vectors.mjs and self-proved against the reference
 * verifier at generation time.
 */
export function GET() {
  return rawJsonResponse(
    readFileSync(
      join(process.cwd(), "src", "data", "test-vectors.json"),
      "utf8",
    ),
  );
}
