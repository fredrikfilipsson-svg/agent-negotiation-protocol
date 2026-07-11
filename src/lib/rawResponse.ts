/**
 * Shared response builder for the raw protocol artifact routes. Implementers
 * $ref these URLs from their own schemas and fetch them from build scripts,
 * so they get permissive CORS and long-lived caching.
 */
export function rawJsonResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "cache-control": "public, max-age=3600, must-revalidate",
    },
  });
}
