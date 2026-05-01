import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

interface PackageJson {
  version?: string;
}

const projectRoot = path.resolve(import.meta.dir, "..");
const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf-8")) as PackageJson;
const packageVersion = packageJson.version;
if (!packageVersion) {
  throw new Error("package.json must define a version before verifying a portable build.");
}

const defaultZip = path.join(projectRoot, "artifacts", `FFXIVGearSetup-portable-win-x64-v${packageVersion}.zip`);
const zipPath = path.resolve(projectRoot, Bun.argv[2] ?? defaultZip);
const checkDir = path.join(projectRoot, "out", "portable-check");

const requiredPaths = [
  "FFXIVAutoBIS.exe",
  "README.txt",
  "bin/launcher.exe",
  "bin/bun.exe",
  "Resources/main.js",
  "Resources/app/data/materias.json",
  "Resources/app/dist/pcap-host.cjs",
  "Resources/app/runtime/node/node.exe",
] as const;

const forbiddenPaths = [
  "Run FFXIV Gear Setup.cmd",
  "FFXIVAutoBIS.lnk",
  "FFXIV Gear Setup.exe",
  "FFXIVGearSetup",
] as const;

const requiredReadmeText = [
  `Version ${packageVersion}`,
  'Run "FFXIVAutoBIS.exe"',
  "Resources\\app\\data\\window-state.json",
  "Resources\\app\\data\\bis\\catalog.json",
  "Resources\\app\\data\\cache\\",
  "Resources\\app\\logs\\inventory.jsonl",
] as const;

function run(cmd: string, args: string[]): void {
  console.log(`> ${[cmd, ...args].join(" ")}`);
  const result = Bun.spawnSync([cmd, ...args], {
    cwd: projectRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed with exit code ${result.exitCode}`);
  }
}

function requirePath(relativePath: string): void {
  const fullPath = path.join(checkDir, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Portable zip is missing required path: ${relativePath}`);
  }
}

function forbidPath(relativePath: string): void {
  const fullPath = path.join(checkDir, relativePath);
  if (existsSync(fullPath)) {
    throw new Error(`Portable zip contains obsolete path: ${relativePath}`);
  }
}

if (!existsSync(zipPath)) {
  throw new Error(`Missing portable zip: ${zipPath}`);
}

await rm(checkDir, { recursive: true, force: true });
await mkdir(checkDir, { recursive: true });

run("powershell", [
  "-NoProfile",
  "-Command",
  `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${checkDir}' -Force`,
]);

for (const relativePath of requiredPaths) requirePath(relativePath);
for (const relativePath of forbiddenPaths) forbidPath(relativePath);

const readme = await readFile(path.join(checkDir, "README.txt"), "utf-8");
for (const text of requiredReadmeText) {
  if (!readme.includes(text)) {
    throw new Error(`README.txt is missing expected text: ${text}`);
  }
}

console.log(`Portable zip verified: ${zipPath}`);
