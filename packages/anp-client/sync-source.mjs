/**
 * Copies the canonical SDK source from src/lib/anp (the single source of
 * truth, exercised by the site's vitest suite and the playground) into this
 * package for compilation. The copied files are build artifacts: they are
 * gitignored and regenerated on every build.
 */
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..", "..", "src", "lib", "anp");
const target = join(here, "src");

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

for (const entry of readdirSync(source, { withFileTypes: true })) {
  if (entry.isDirectory()) continue; // skips __tests__
  cpSync(join(source, entry.name), join(target, entry.name));
}

console.log(`synced ${readdirSync(target).length} source files from src/lib/anp`);
