import { defineConfig } from "tsup"

export default defineConfig([
  // library entry, consumable from both module systems
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    treeshake: true,
    clean: true,
  },
  // cli entry, esm only since it relies on top level await
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    banner: { js: "#!/usr/bin/env node" },
    clean: false,
  },
])
