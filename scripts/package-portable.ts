import { existsSync } from "node:fs";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dir, "..");
const outDir = path.join(projectRoot, "out");
const stagingDir = path.join(outDir, "portable-staging");
const portableRoot = path.join(stagingDir, "FFXIVGearSetup");
const appRoot = path.join(portableRoot, "Resources", "app");
const artifactsDir = path.join(projectRoot, "artifacts");
const runtimeNodeDir = path.join(appRoot, "runtime", "node");
const portableZip = path.join(artifactsDir, "FFXIVGearSetup-portable-win-x64.zip");
const portableZipTmp = path.join(artifactsDir, "FFXIVGearSetup-portable-win-x64.zip.tmp");
const launchScriptName = "Run FFXIV Gear Setup.cmd";

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

async function copyDir(src: string, dest: string): Promise<void> {
  if (!existsSync(src)) throw new Error(`Missing required directory: ${src}`);
  await cp(src, dest, { recursive: true });
}

async function copyFile(src: string, dest: string): Promise<void> {
  if (!existsSync(src)) throw new Error(`Missing required file: ${src}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(src, dest);
}

function findNodeExe(): string {
  const configured = process.env["PORTABLE_NODE_EXE"];
  if (configured && existsSync(configured)) return configured;

  const where = Bun.spawnSync(["where.exe", "node"], {
    cwd: projectRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (where.exitCode === 0) {
    const first = new TextDecoder().decode(where.stdout).split(/\r?\n/).find(Boolean);
    if (first && existsSync(first)) return first;
  }

  throw new Error("Could not find node.exe. Set PORTABLE_NODE_EXE to a Node 22 executable.");
}

function findElectrobunPayload(): string {
  const candidates = [
    path.join(artifactsDir, "stable-win-x64-FFXIVGearSetup.tar.zst"),
    path.join(projectRoot, "build", "stable-win-x64", "FFXIV Gear Setup-Setup.tar.zst"),
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
    JSON.stringify({ name: "ffxiv_gear_setup_portable", type: "module" }, null, 2) + "\n",
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
  await writeFile(
    path.join(stagingDir, launchScriptName),
    [
      "@echo off",
      "setlocal",
      'set "APP_DIR=%~dp0FFXIVGearSetup"',
      'if not exist "%APP_DIR%\\bin\\launcher.exe" (',
      "  echo Could not find FFXIVGearSetup\\bin\\launcher.exe.",
      "  echo Please extract the entire portable zip before running this launcher.",
      "  pause",
      "  exit /b 1",
      ")",
      'start "" "%APP_DIR%\\bin\\launcher.exe"',
      "",
    ].join("\r\n"),
    "utf-8",
  );

  await writeFile(
    path.join(stagingDir, "README.txt"),
    [
      "FFXIV Gear Setup Portable",
      "",
      `Run "${launchScriptName}" after extracting the whole zip.`,
      "",
      "The application files live in the FFXIVGearSetup folder.",
      "For live packet capture, keep the folder in a user-writable location.",
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
  run("electrobun", ["build", "--env=stable"]);

  run("tar", ["-xf", findElectrobunPayload(), "-C", stagingDir]);
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

  console.log(`Portable zip created: ${portableZip}`);
}

await main();
