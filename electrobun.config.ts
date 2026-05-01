import { readFileSync } from "node:fs";

interface PackageJson {
  version?: string;
}

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as PackageJson;

if (!packageJson.version) {
  throw new Error("package.json must define a version before building Electrobun.");
}

export default {
  app: {
    name: "FFXIV Gear Setup",
    identifier: "com.ffxiv.gear-setup",
    version: packageJson.version,
  },
  build: {
    bun: {
      entrypoint: "src/desktop/index.ts",
    },
  },
  runtime: {
    exitWhenWindowsClosed: true,
  },
};
