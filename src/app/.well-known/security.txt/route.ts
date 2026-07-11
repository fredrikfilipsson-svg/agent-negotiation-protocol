import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/** RFC 9116 security contact, matching the governance page. */
export function GET() {
  const body = [
    // Interim contact until a mailbox exists on the site's own domain.
    "Contact: mailto:info@redresscompliance.com",
    `Canonical: ${SITE_URL}/.well-known/security.txt`,
    "Preferred-Languages: en",
    // Regenerated on every build; one year out per RFC 9116 guidance.
    `Expires: ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}`,
  ].join("\n");
  return new Response(body + "\n", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
