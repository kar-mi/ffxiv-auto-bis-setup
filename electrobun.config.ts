export default {
  app: {
    name: "FFXIV Gear Setup",
    identifier: "com.ffxiv.gear-setup",
    version: "0.1.0",
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
