import { build } from "esbuild";
await build({
  entryPoints: ["src/cli.ts", "src/server.ts"],
  outdir: "dist",
  bundle: true,
  packages: "external",
  platform: "node",
  target: "node22",
  format: "esm",
  banner: { js: "#!/usr/bin/env node" },
});
