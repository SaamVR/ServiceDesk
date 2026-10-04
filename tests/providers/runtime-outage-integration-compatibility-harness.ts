import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] ?? process.cwd());
const sourceRoots = ["src/server/integrations", "src/server/ai", "src/server/api-handlers", "tests/providers", "tests/ai"];
const productUiPrefixes = ["src/app/", "src/features/", "src/components/", "src/styles/", "public/"];
const extensions = [".ts", ".tsx"];

function walk(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    if (stat.isFile() && extensions.includes(extname(path))) files.push(path);
  }
  return files;
}

function candidates(importer: string, specifier: string): string[] {
  const base = resolve(dirname(importer), specifier);
  return [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
}

function localImports(content: string): string[] {
  const specs: string[] = [];
  const patterns = [/from\s+["']([^"']+)["']/g, /import\s*\(\s*["']([^"']+)["']\s*\)/g];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier?.startsWith(".")) specs.push(specifier);
    }
  }
  return specs;
}

const files = sourceRoots.flatMap((sourceRoot) => walk(join(root, sourceRoot)));
const missing: string[] = [];
const forbidden: string[] = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const relativeImporter = normalize(file.slice(root.length + 1)).replace(/\\/g, "/");
  for (const specifier of localImports(content)) {
    const resolved = candidates(file, specifier).find((candidate) => existsSync(candidate));
    if (!resolved) missing.push(`${relativeImporter} -> ${specifier}`);
    if (resolved) {
      const relativeTarget = normalize(resolved.slice(root.length + 1)).replace(/\\/g, "/");
      if (productUiPrefixes.some((prefix) => relativeTarget.startsWith(prefix))) forbidden.push(`${relativeImporter} -> ${relativeTarget}`);
    }
  }
}

assert.deepEqual(missing, []);
assert.deepEqual(forbidden, []);
console.log(`runtime-outage-integration-compatibility-harness PASS files=${files.length}`);
