import { existsSync, statSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

interface PackageJson {
  version?: string;
}

const projectRoot = path.resolve(import.meta.dir, "..");
const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf-8")) as PackageJson;
const packageVersion = packageJson.version;
if (!packageVersion) {
  throw new Error("package.json must define a version before packaging.");
}
const artifactBaseName = `FFXIVGearSetup-portable-win-x64-v${packageVersion}`;
const outDir = path.join(projectRoot, "out");
const stagingDir = path.join(outDir, "portable-staging");
const extractedPayloadRoot = path.join(stagingDir, "FFXIVGearSetup");
const portableRoot = stagingDir;
const appRoot = path.join(portableRoot, "Resources", "app");
const artifactsDir = path.join(projectRoot, "artifacts");
const runtimeNodeDir = path.join(appRoot, "runtime", "node");
const portableZip = path.join(artifactsDir, `${artifactBaseName}.zip`);
const portableZipTmp = path.join(artifactsDir, `${artifactBaseName}.tmp.zip`);
const launcherExeName = "FFXIVAutoBIS.exe";

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

function runElectrobunBuild(): void {
  const startedAt = Date.now();
  console.log("> electrobun build --env=stable");
  const result = Bun.spawnSync(["electrobun", "build", "--env=stable"], {
    cwd: projectRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode === 0) return;

  const buildPayload = path.join(projectRoot, "build", "stable-win-x64", "FFXIV Gear Setup-Setup.tar.zst");
  // Electrobun 1.16 can exit non-zero after producing a fresh payload on Windows.
  // Keep this narrowly scoped to a just-written payload so real build failures still fail packaging.
  if (existsSync(buildPayload) && statSync(buildPayload).mtimeMs >= startedAt - 5000) {
    console.warn(
      `[package] electrobun exited ${result.exitCode}, but a fresh stable payload exists; continuing with ${buildPayload}`,
    );
    return;
  }

  throw new Error(`electrobun build --env=stable failed with exit code ${result.exitCode}`);
}

async function copyDir(src: string, dest: string): Promise<void> {
  if (!existsSync(src)) throw new Error(`Missing required directory: ${src}`);
  await cp(src, dest, { recursive: true });
}

async function copyFile(src: string, dest: string): Promise<void> {
  if (!existsSync(src)) throw new Error(`Missing required file: ${src}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(src, dest);
}

async function flattenElectrobunPayload(): Promise<void> {
  if (!existsSync(extractedPayloadRoot)) throw new Error(`Missing extracted payload: ${extractedPayloadRoot}`);
  const entries = await readdir(extractedPayloadRoot);
  for (const entry of entries) {
    await rename(path.join(extractedPayloadRoot, entry), path.join(stagingDir, entry));
  }
  await rm(extractedPayloadRoot, { recursive: true, force: true });
}

function findNodeExe(): string {
  const configured = process.env["PORTABLE_NODE_EXE"];
  if (configured && existsSync(configured)) {
    assertNode22(configured);
    return configured;
  }

  const where = Bun.spawnSync(["where.exe", "node"], {
    cwd: projectRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (where.exitCode === 0) {
    const first = new TextDecoder().decode(where.stdout).split(/\r?\n/).find(Boolean);
    if (first && existsSync(first)) {
      assertNode22(first);
      return first;
    }
  }

  throw new Error("Could not find node.exe. Set PORTABLE_NODE_EXE to a Node 22 executable.");
}

function assertNode22(nodeExe: string): void {
  const result = Bun.spawnSync([nodeExe, "--version"], {
    cwd: projectRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = new TextDecoder().decode(result.stdout).trim();
  const stderr = new TextDecoder().decode(result.stderr).trim();
  if (result.exitCode !== 0) {
    throw new Error(`Could not run ${nodeExe} --version: ${stderr || stdout}`);
  }

  const match = /^v(\d+)\./.exec(stdout);
  if (!match || match[1] !== "22") {
    throw new Error(`Portable builds require Node 22; ${nodeExe} reported ${stdout || "unknown version"}.`);
  }
}

function findElectrobunPayload(): string {
  const candidates = [
    path.join(projectRoot, "build", "stable-win-x64", "FFXIV Gear Setup-Setup.tar.zst"),
    path.join(artifactsDir, "stable-win-x64-FFXIVGearSetup.tar.zst"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error("Missing Electrobun stable payload. Expected artifacts/stable-win-x64-FFXIVGearSetup.tar.zst.");
  }
  return found;
}

async function seedRuntimeFiles(): Promise<void> {
  await copyDir(path.join(projectRoot, "public"), path.join(appRoot, "public"));
  await copyDir(path.join(projectRoot, "raidinfo"), path.join(appRoot, "raidinfo"));
  await copyFile(path.join(projectRoot, "data", "materias.json"), path.join(appRoot, "data", "materias.json"));
  await writeFile(
    path.join(appRoot, "package.json"),
    JSON.stringify({ name: "ffxiv_gear_setup_portable", version: packageVersion, type: "module" }, null, 2) + "\n",
    "utf-8",
  );

  await copyFile(path.join(projectRoot, "dist", "pcap-host.cjs"), path.join(appRoot, "dist", "pcap-host.cjs"));
  await copyDir(
    path.join(projectRoot, "node_modules", "@ffxiv-teamcraft"),
    path.join(appRoot, "node_modules", "@ffxiv-teamcraft"),
  );
  await copyDir(path.join(projectRoot, "node_modules", "bindings"), path.join(appRoot, "node_modules", "bindings"));
  await copyDir(
    path.join(projectRoot, "node_modules", "file-uri-to-path"),
    path.join(appRoot, "node_modules", "file-uri-to-path"),
  );

  await copyFile(findNodeExe(), path.join(runtimeNodeDir, "node.exe"));
}

async function seedTopLevelLaunchers(): Promise<void> {
  run("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(projectRoot, "scripts", "build-portable-launcher.ps1"),
    "-OutputPath",
    path.join(portableRoot, launcherExeName),
  ]);

  await writeFile(
    path.join(stagingDir, "README.txt"),
    [
      "FFXIV Auto BIS Portable",
      `Version ${packageVersion}`,
      "",
      `Run "${launcherExeName}" after extracting the whole zip.`,
      "Do not move it away from the bin and Resources folders.",
      "",
      "Keep the extracted files together in a user-writable location; saved settings and live capture data write back into this folder.",
      "",
      "Generated files:",
      "- App settings: Resources\\app\\data\\settings.json",
      "- Window size/position: Resources\\app\\data\\window-state.json",
      "- Saved BIS sets/preferences: Resources\\app\\data\\bis\\catalog.json",
      "- Gear and inventory cache: Resources\\app\\data\\cache\\",
      "- Optional inventory debug log: Resources\\app\\logs\\inventory.jsonl when INVENTORY_LOG=1",
      "",
    ].join("\r\n"),
    "utf-8",
  );
}

async function main(): Promise<void> {
  await rm(stagingDir, { recursive: true, force: true });
  await rm(portableZipTmp, { force: true });
  await mkdir(stagingDir, { recursive: true });
  await mkdir(artifactsDir, { recursive: true });

  run("bun", ["run", "build:ui:prod"]);
  run("bun", [
    "build",
    "src/pcap/host.ts",
    "--target=node",
    "--format=cjs",
    "--outfile=dist/pcap-host.cjs",
    "--external=@ffxiv-teamcraft/pcap-ffxiv",
  ]);
  runElectrobunBuild();

  run("tar", ["-xf", findElectrobunPayload(), "-C", stagingDir]);
  await flattenElectrobunPayload();
  await seedRuntimeFiles();
  await seedTopLevelLaunchers();

  run("powershell", [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${path.join(stagingDir, "*")}' -DestinationPath '${portableZipTmp}' -Force`,
  ]);
  await rm(portableZip, { force: true });
  await cp(portableZipTmp, portableZip);
  await rm(portableZipTmp, { force: true });
  run("bun", ["run", "verify:portable", portableZip]);

  console.log(`Portable zip created: ${portableZip}`);
}

await main();
