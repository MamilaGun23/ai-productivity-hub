import { execFileSync } from "node:child_process";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const secrets = [
  process.env.GEMINI_API_KEY,
  process.env.UPSTASH_REDIS_REST_TOKEN,
  process.env.VERCEL_OIDC_TOKEN,
].filter((value) => value && value.length >= 16);
const git =
  process.platform === "win32" ? "C:\\Program Files\\Git\\cmd\\git.exe" : "git";
const paths = execFileSync(
  git,
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const matches = [];
let repositoryFiles = 0,
  browserChunks = 0;
for (const path of paths) {
  try {
    if (!(await stat(path)).isFile()) continue;
    const content = await readFile(path);
    repositoryFiles++;
    if (secrets.some((secret) => content.includes(secret))) matches.push(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
async function scanChunks(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) await scanChunks(path);
    else if (/\.(js|map)$/.test(item.name)) {
      const content = await readFile(path);
      browserChunks++;
      if (secrets.some((secret) => content.includes(secret)))
        matches.push(path);
    }
  }
}
await scanChunks(".next/static/chunks");
const report = {
  checkedAt: new Date().toISOString(),
  configuredSecretsChecked: secrets.length,
  repositoryFiles,
  browserChunks,
  matches,
};
await writeFile(
  "docs/redesign-security-results.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
if (!secrets.length || matches.length) process.exitCode = 1;
