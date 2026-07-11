import { readSchema } from "@/lib/protocol";
import { rawJsonResponse } from "@/lib/rawResponse";

export const dynamic = "force-static";

export function GET() {
  return rawJsonResponse(readSchema("event.schema.json"));
}
