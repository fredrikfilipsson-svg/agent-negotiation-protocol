import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Every page and route handler in this site is prerendered at build time.
// The static assets incremental cache serves that prerendered output from
// the asset bundle, so nothing ever tries to re-render in the worker
// (where the protocol/ files and the markdown pipeline do not exist).
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
