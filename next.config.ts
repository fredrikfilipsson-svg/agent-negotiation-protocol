import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site is static-first: every page except the playground's client
  // interactivity is prerendered at build time. Route handlers under
  // /schemas/* serve the protocol schema files with CORS headers so
  // implementers can $ref them.
  reactStrictMode: true,
  // Overridable so parallel dev servers or builds in one checkout do not
  // clobber each other's compilation output.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // One canonical host: www permanently redirects to the apex domain so
  // search engines never index duplicate content on two hosts.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host" as const, value: "www.aiaagentnetwork.com" }],
        destination: "https://aiaagentnetwork.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
